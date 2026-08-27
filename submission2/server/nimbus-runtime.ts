import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';

export const HERO_SEGMENT_ID = 'SEG-0000214';
export const HERO_EXPERIMENT_ID = 'EXP-0000009';

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

export type DecisionStatus = 'proposed' | 'approved' | 'committed';

export function assertTransition(from: DecisionStatus, to: DecisionStatus, approver?: string | null) {
  const valid = (from === 'proposed' && to === 'approved') ||
    (from === 'approved' && to === 'committed');
  if (!valid) throw new Error(`Invalid decision transition: ${from} -> ${to}`);
  if (to === 'committed' && !approver) throw new Error('An approved_by identity is required before commit');
}

export function parseActionRanking(value: unknown) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
  }
  return [];
}

export async function initializeDecisionSchema(pool: Pool) {
  await pool.query('SELECT 1 FROM app.feature_decisions_app LIMIT 1');
}

export async function getLiveView(pool: Pool, segmentId: string | null, limit = 40) {
  const result = await pool.query(LIVE_VIEW_SQL, [segmentId, Math.min(Math.max(limit, 1), 40)]);
  return { queried_at: new Date().toISOString(), row_count: result.rowCount, rows: result.rows };
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
  const audit = [{ at, by: 'nimbus-assistant', action: 'proposed', notes: 'AI draft awaiting human approval', tool: 'assist' }];
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

export async function transitionDecision(pool: Pool, decisionId: string, to: 'approved' | 'committed', actor: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = await lockDecision(client, decisionId);
    assertTransition(current.status, to, current.approved_by || (to === 'approved' ? actor : null));
    const at = new Date().toISOString();
    const audit = Array.isArray(current.audit_trail) ? current.audit_trail : [];
    audit.push({ at, by: actor, action: to, notes: to === 'approved' ? 'Human approval recorded' : 'Decision committed', tool: `decision_${to}` });
    const result = await client.query(
      `UPDATE app.feature_decisions_app
          SET status=$2,
              approved_by=CASE WHEN $2='approved' THEN $3 ELSE approved_by END,
              decided_at=CASE WHEN $2='committed' THEN $4 ELSE decided_at END,
              audit_trail=$5::jsonb
        WHERE id=$1 RETURNING *`,
      [decisionId, to, actor, at, JSON.stringify(audit)],
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
