import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';

export const HERO_SEGMENT_ID = 'SEG-0000214';
export const HERO_EXPERIMENT_ID = 'EXP-0000009';
export const EXPERIMENT_SEARCH_INDEX = 'experiments_description_bm25_idx';
export const EXPERIMENT_SEARCH_METHOD = 'lakebase_text BM25';
export const EXPERIMENT_SEARCH_FUNCTION = 'app.search_experiments';
export const EXPERIMENT_SOURCE_TABLE = 'nimbus_serving.experiments';
export const EXPERIMENT_SOURCE_KIND = 'Build 1 continuous sync';

export const LIVE_VIEW_SQL = `WITH ranked_sliding AS (
  SELECT os.*,
         row_number() OVER (ORDER BY os.conversion_at_risk_usd DESC, os.segment_id) AS risk_rank
    FROM nimbus_serving.open_sliding os
), latest_decision AS (
  SELECT DISTINCT ON (segment_id)
         id AS decision_id, segment_id, action_type, target_experiment_id,
         flag_key, variant, rollout_pct, status AS decision_status,
         approved_by, created_at, decided_at
    FROM app.feature_decisions_app
   ORDER BY segment_id, created_at DESC
)
SELECT sp.segment_id, sp.cohort, sp.platform, sp.region, sp.segment_summary,
       sp.mau, sp.conversion_rate, sp.conversion_rate_3w_ago,
       sp.conversion_drop, sp.slide_signal_score, sp.conv_band,
       sp.conversion_at_risk_usd, rs.risk_rank,
       rs.has_matching_experiment, rs.matching_experiment_id,
       rs.matching_experiment_lift, rs.neighbor_flag_key,
       ar.recommended_action, ar.predicted_conversion_lift,
       ar.predicted_net_value_usd, ar.action_ranking, ar.scored_at,
       ld.decision_id, ld.action_type AS decided_action,
       ld.target_experiment_id, ld.flag_key, ld.variant, ld.rollout_pct,
       ld.decision_status, ld.approved_by, ld.created_at AS decision_created_at,
       ld.decided_at
  FROM nimbus_serving.segment_positions sp
  JOIN ranked_sliding rs USING (segment_id)
  LEFT JOIN nimbus_serving.action_recommendations ar USING (segment_id)
  LEFT JOIN latest_decision ld USING (segment_id)
 WHERE ($1::text IS NULL OR sp.segment_id = $1)
 ORDER BY rs.risk_rank
 LIMIT $2`;

export type DecisionStatus = 'investigating' | 'investigation_failed' | 'proposed' | 'approved' | 'committed';

export function assertTransition(from: DecisionStatus, to: DecisionStatus, approver?: string | null) {
  const valid = (from === 'proposed' && to === 'approved') ||
    (from === 'approved' && to === 'committed');
  if (!valid) throw new Error(`Invalid decision transition: ${from} -> ${to}`);
  if (to === 'committed' && !approver) throw new Error('An approved_by identity is required before commit');
}

export async function createInvestigationCase(pool: Pool) {
  const client = await pool.connect();
  const decisionId = randomUUID();
  const at = new Date().toISOString();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('nimbus-next-investigation'))");
    const candidate = await client.query(
      `SELECT os.segment_id, os.neighbor_flag_key, ar.recommended_action,
              ar.predicted_conversion_lift
         FROM nimbus_serving.open_sliding os
         LEFT JOIN nimbus_serving.action_recommendations ar USING (segment_id)
        WHERE NOT EXISTS (
          SELECT 1 FROM app.feature_decisions_app fd WHERE fd.segment_id=os.segment_id
        )
        ORDER BY os.conversion_at_risk_usd DESC, os.segment_id
        LIMIT 1`,
    );
    const row = candidate.rows[0] as Record<string, unknown> | undefined;
    if (!row) throw new Error('No unprocessed risk segment available');
    const audit = [{ at, by: 'nimbus-assistant', action: 'investigating', notes: 'Investigation queued', tool: 'investigation_next' }];
    const inserted = await client.query(
      `INSERT INTO app.feature_decisions_app
         (id, segment_id, action_type, flag_key, rollout_pct, predicted_conversion_lift,
          status, audit_trail, created_at)
       VALUES ($1,$2,$3,$4,100,$5,'investigating',$6::jsonb,$7)
       RETURNING *`,
      [decisionId, row.segment_id, row.recommended_action ?? 'ship_proven_variant',
        row.neighbor_flag_key ?? '', row.predicted_conversion_lift ?? null, JSON.stringify(audit), at],
    );
    await client.query('COMMIT');
    return inserted.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function completeInvestigation(pool: Pool, decisionId: string, input: {
  assistRunId: string; experimentId: string | null; draftedNote: string;
  actionType: string; flagKey: string; variant: string; predictedConversionLift: number | null;
}) {
  const at = new Date().toISOString();
  const result = await pool.query(
    `UPDATE app.feature_decisions_app
        SET target_experiment_id=$2, drafted_note=$3, action_type=$4, flag_key=$5,
            variant=$6, predicted_conversion_lift=$7, status='proposed',
            audit_trail=audit_trail || $8::jsonb
      WHERE id=$1 AND status IN ('investigating','investigation_failed')
      RETURNING *`,
    [decisionId, input.experimentId, input.draftedNote, input.actionType, input.flagKey,
      input.variant, input.predictedConversionLift, JSON.stringify([{ at, by: 'nimbus-assistant',
        action: 'proposed', notes: 'AI draft awaiting human approval', tool: 'investigation_run',
        assist_run_id: input.assistRunId }])],
  );
  if (!result.rows[0]) throw new Error(`Invalid investigation state: ${decisionId}`);
  return result.rows[0];
}

export async function failInvestigation(pool: Pool, decisionId: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const at = new Date().toISOString();
  await pool.query(
    `UPDATE app.feature_decisions_app
        SET status='investigation_failed',
            audit_trail=audit_trail || $2::jsonb
      WHERE id=$1 AND status='investigating'`,
    [decisionId, JSON.stringify([{ at, by: 'nimbus-assistant', action: 'investigation_failed',
      notes: message, tool: 'investigation_run' }])],
  );
}

export function parseActionRanking(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) {
    return value.filter((item): item is Record<string, unknown> =>
      typeof item === 'object' && item !== null && !Array.isArray(item));
  }
  if (typeof value === 'string') {
    const parsed: unknown = JSON.parse(value);
    return parseActionRanking(parsed);
  }
  return [];
}

export function buildKoreanEvidencePrompt(
  metric: Record<string, unknown>,
  recommendation: Record<string, unknown>,
  experiment: Record<string, unknown>,
) {
  return `다음 조사 근거를 의사결정자가 빠르게 검토할 수 있는 한국어 GFM Markdown으로 작성하세요.

반드시 아래 네 개의 2단계 제목을 정확한 순서로 사용하세요.
## 한줄 결론
## 판단 근거
## 기대 효과
## 실행 전 확인사항

작성 규칙:
- 각 섹션은 1~3개의 짧은 문장 또는 글머리표로 작성합니다.
- 실험 ID, 세그먼트 ID, 변형명, 플래그 키처럼 원문 보존이 필요한 고유 식별자를 제외하고 모두 자연스러운 한국어로 씁니다.
- 입력에 있는 수치와 근거만 사용하고, 임의의 수치나 고정 롤아웃 비율을 제안하지 않습니다.
- 승인, 실행, 기록이 이미 완료되었다고 표현하지 않습니다.
- 별도의 문서 제목, 영문 섹션 제목, 상태 문구는 추가하지 않습니다.

세그먼트: ${JSON.stringify(metric)}
추천 액션: ${JSON.stringify(recommendation)}
실험 근거: ${JSON.stringify(experiment)}`;
}

export async function redraftProposedDecision(
  pool: Pool,
  decisionId: string,
  draftedNote: string,
  assistRunId: string,
) {
  const at = new Date().toISOString();
  const audit = [{
    at,
    by: 'nimbus-assistant',
    action: 'redrafted',
    notes: '한국어 AI 근거 요약으로 다시 작성',
    tool: 'decision_redraft',
    assist_run_id: assistRunId,
  }];
  const result = await pool.query(
    `UPDATE app.feature_decisions_app
        SET drafted_note=$2,
            audit_trail=audit_trail || $3::jsonb
      WHERE id=$1 AND status='proposed'
      RETURNING *`,
    [decisionId, draftedNote, JSON.stringify(audit)],
  );
  if (!result.rows[0]) throw new Error(`Invalid redraft state: ${decisionId}`);
  return result.rows[0];
}

export async function initializeDecisionSchema(pool: Pool) {
  await pool.query('SELECT 1 FROM app.feature_decisions_app LIMIT 1');
}

export async function getLiveView(pool: Pool, segmentId: string | null, limit = 40) {
  const result = await pool.query(LIVE_VIEW_SQL, [segmentId, Math.min(Math.max(limit, 1), 40)]);
  return { queried_at: new Date().toISOString(), row_count: result.rowCount, rows: result.rows };
}

export async function getCases(pool: Pool) {
  const live = await getLiveView(pool, null, 40);
  return {
    queried_at: live.queried_at,
    cases: live.rows
      .filter((row) => row.decision_id)
      .sort((a, b) => {
        const left = Date.parse(String(a.decided_at ?? a.decision_created_at ?? 0));
        const right = Date.parse(String(b.decided_at ?? b.decision_created_at ?? 0));
        return right - left;
      }),
  };
}

export async function getCase(pool: Pool, decisionId: string) {
  const decision = await getDecision(pool, decisionId);
  const row = decision.rows[0];
  const live = await getLiveView(pool, String(row.segment_id), 1);
  const metric = live.rows[0];
  if (!metric) throw new Error(`Segment not found: ${String(row.segment_id)}`);
  const experimentId = row.target_experiment_id ? String(row.target_experiment_id) : null;
  let experiment: Record<string, unknown> | null = null;
  if (experimentId) {
    const result = await pool.query(
      'SELECT * FROM app.search_experiments($1, $2) WHERE experiment_id=$3 LIMIT 1',
      [experimentId, 10, experimentId],
    );
    experiment = result.rows[0] ?? null;
  }
  return {
    queried_at: new Date().toISOString(),
    case: { ...metric, ...row, experiment, audit_trail: row.audit_trail ?? [] },
  };
}

export function validateRolloutPct(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 100) {
    throw new Error('rollout_pct must be between 1 and 100');
  }
  return parsed;
}

export async function getSearchExperiments(pool: Pool, query: string, limit = 5) {
  const boundedLimit = Math.min(Math.max(limit, 1), 20);
  const searchSql =
    'SELECT * FROM app.search_experiments($1, $2) ORDER BY relevance DESC NULLS LAST LIMIT $2';
  const result = await pool.query(searchSql, [query, boundedLimit]);
  const client = await pool.connect();
  let explained;
  try {
    await client.query('BEGIN READ ONLY');
    await client.query('SET LOCAL enable_seqscan=off');
    explained = await client.query(`EXPLAIN (FORMAT TEXT) ${searchSql}`, [query, boundedLimit]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  const executionPlan = explained.rows
    .map((row) => String(row['QUERY PLAN'] ?? row.query_plan ?? ''))
    .filter(Boolean);
  return {
    executed_at: new Date().toISOString(),
    query,
    method: EXPERIMENT_SEARCH_METHOD,
    search_function: EXPERIMENT_SEARCH_FUNCTION,
    source_table: EXPERIMENT_SOURCE_TABLE,
    source_kind: EXPERIMENT_SOURCE_KIND,
    read_only: true,
    index: EXPERIMENT_SEARCH_INDEX,
    execution_plan: executionPlan,
    row_count: result.rowCount,
    rows: result.rows,
  };
}

export async function getDecision(pool: Pool, decisionId: string) {
  const result = await pool.query(
    'SELECT * FROM app.feature_decisions_app WHERE id=$1 LIMIT 1',
    [decisionId],
  );
  if (!result.rows[0]) throw new Error(`Decision not found: ${decisionId}`);
  const row = result.rows[0] as Record<string, unknown>;
  const auditTrail = Array.isArray(row.audit_trail) ? row.audit_trail : [];
  const proposed = auditTrail.find((event) =>
    typeof event === 'object' && event !== null && event.action === 'proposed',
  ) as Record<string, unknown> | undefined;
  return {
    queried_at: new Date().toISOString(),
    table: 'app.feature_decisions_app',
    app_written: true,
    assist_run_id: proposed?.assist_run_id ?? null,
    segment_id: row.segment_id,
    experiment_id: row.target_experiment_id,
    decision_id: row.id,
    row_count: 1,
    columns: Object.keys(row),
    rows: [row],
  };
}

type ProposedDecision = {
  assistRunId: string;
  segmentId: string;
  experimentId: string | null;
  actionType: string;
  flagKey: string;
  variant: string;
  rolloutPct: number | null;
  draftedNote: string;
  predictedConversionLift: number | null;
};

export async function createProposedDecision(pool: Pool, input: ProposedDecision) {
  const decisionId = randomUUID();
  const at = new Date().toISOString();
  const audit = [{
    at,
    by: 'nimbus-assistant',
    action: 'proposed',
    notes: 'AI draft awaiting human approval',
    tool: 'assist',
    assist_run_id: input.assistRunId,
  }];
  const result = await pool.query(
    `INSERT INTO app.feature_decisions_app
       (id, segment_id, action_type, target_experiment_id, flag_key, variant,
        rollout_pct, drafted_note, predicted_conversion_lift, status, audit_trail, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'proposed',$10::jsonb,$11)
     RETURNING *`,
    [decisionId, input.segmentId, input.actionType, input.experimentId, input.flagKey,
      input.variant, input.rolloutPct, input.draftedNote, input.predictedConversionLift,
      JSON.stringify(audit), at],
  );
  return { assist_run_id: input.assistRunId, experiment_id: input.experimentId, ...result.rows[0] };
}

async function lockDecision(client: PoolClient, decisionId: string) {
  const result = await client.query('SELECT * FROM app.feature_decisions_app WHERE id=$1 FOR UPDATE', [decisionId]);
  if (!result.rows[0]) throw new Error(`Decision not found: ${decisionId}`);
  return result.rows[0] as Record<string, unknown> & { status: DecisionStatus; approved_by: string | null; audit_trail: unknown };
}

export async function transitionDecision(pool: Pool, decisionId: string, to: 'approved' | 'committed', actor: string, rolloutPct?: number) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = await lockDecision(client, decisionId);
    assertTransition(current.status, to, current.approved_by || (to === 'approved' ? actor : null));
    const at = new Date().toISOString();
    const audit = Array.isArray(current.audit_trail) ? current.audit_trail : [];
    audit.push({ at, by: actor, action: to, notes: to === 'approved' ? 'Human approval recorded' : 'Decision committed', tool: `decision_${to}` });
    const approvedRollout = to === 'approved' ? validateRolloutPct(rolloutPct) : null;
    const result = await client.query(
      `UPDATE app.feature_decisions_app
          SET status=$2,
              approved_by=CASE WHEN $2='approved' THEN $3 ELSE approved_by END,
              decided_at=CASE WHEN $2='committed' THEN $4 ELSE decided_at END,
              audit_trail=$5::jsonb,
              rollout_pct=CASE WHEN $2='approved' THEN $6 ELSE rollout_pct END
        WHERE id=$1 RETURNING *`,
      [decisionId, to, actor, at, JSON.stringify(audit), approvedRollout],
    );
    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function resetDemoDecision(pool: Pool, segmentId: string) {
  if (segmentId !== HERO_SEGMENT_ID) {
    throw new Error(`Demo reset is restricted to ${HERO_SEGMENT_ID}`);
  }
  const result = await pool.query(
    'DELETE FROM app.feature_decisions_app WHERE segment_id=$1',
    [segmentId],
  );
  return {
    segment_id: segmentId,
    deleted_count: result.rowCount ?? 0,
    reset_at: new Date().toISOString(),
    synchronized_sources_changed: false,
  };
}
