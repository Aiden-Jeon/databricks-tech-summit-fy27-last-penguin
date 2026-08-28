import { describe, expect, it, vi } from 'vitest';
import { assertTransition, buildKoreanEvidencePrompt, completeInvestigation, createInvestigationCase, failInvestigation, getDecision, getSearchExperiments, initializeDecisionSchema, parseActionRanking, redraftProposedDecision, resetDemoDecision, validateRolloutPct } from './nimbus-runtime.js';
import type { Pool } from 'pg';

describe('decision state machine', () => {
  it('accepts only proposed -> approved -> committed', () => {
    expect(() => assertTransition('proposed', 'approved', 'vp@example.com')).not.toThrow();
    expect(() => assertTransition('approved', 'committed', 'vp@example.com')).not.toThrow();
    expect(() => assertTransition('proposed', 'committed', null)).toThrow(/Invalid/);
    expect(() => assertTransition('approved', 'committed', null)).toThrow(/approved_by/);
  });

  it('accepts only rollout percentages from 1 through 100', () => {
    expect(validateRolloutPct(1)).toBe(1);
    expect(validateRolloutPct(50)).toBe(50);
    expect(validateRolloutPct(100)).toBe(100);
    expect(() => validateRolloutPct(0)).toThrow(/between 1 and 100/);
    expect(() => validateRolloutPct(101)).toThrow(/between 1 and 100/);
  });
});

describe('investigation lifecycle', () => {
  it('requires the five-state Lakebase check constraint at startup', async () => {
    const pool = Object.create(null) as Pool;
    pool.query = vi.fn().mockResolvedValue({
      rows: [{ definition: "CHECK ((status = ANY (ARRAY['investigating'::text, 'investigation_failed'::text, 'proposed'::text, 'approved'::text, 'committed'::text])))" }],
    });
    await expect(initializeDecisionSchema(pool)).resolves.toBeUndefined();

    pool.query = vi.fn().mockResolvedValue({
      rows: [{ definition: "CHECK ((status = ANY (ARRAY['proposed'::text, 'approved'::text, 'committed'::text])))" }],
    });
    await expect(initializeDecisionSchema(pool)).rejects.toThrow(/Incompatible.*status constraint/);
  });

  it('creates the highest-risk unprocessed case as investigating inside a lock', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ segment_id: 'SEG-HIGH', recommended_action: 'ship_proven_variant' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'case-1', segment_id: 'SEG-HIGH', status: 'investigating' }] })
      .mockResolvedValueOnce({});
    const release = vi.fn();
    const pool = Object.create(null) as Pool;
    pool.connect = vi.fn().mockResolvedValue({ query, release });
    const result = await createInvestigationCase(pool);
    expect(result).toMatchObject({ segment_id: 'SEG-HIGH', status: 'investigating' });
    expect(String(query.mock.calls[2][0])).toContain('NOT EXISTS');
    expect(String(query.mock.calls[2][0])).toContain('ORDER BY os.conversion_at_risk_usd DESC');
    expect(String(query.mock.calls[3][0])).toContain("'investigating'");
    expect(release).toHaveBeenCalled();
  });

  it('updates the same case to proposed and preserves failures in its audit trail', async () => {
    const pool = Object.create(null) as Pool;
    pool.query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ id: 'case-1', status: 'proposed' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'case-1', status: 'investigation_failed' }] });
    const completed = await completeInvestigation(pool, 'case-1', {
      assistRunId: 'run-1', experimentId: 'EXP-1', draftedNote: 'memo', actionType: 'ship_proven_variant',
      flagKey: 'flag', variant: 'v1', predictedConversionLift: .02,
    });
    expect(completed).toMatchObject({ id: 'case-1', status: 'proposed' });
    expect(String(vi.mocked(pool.query).mock.calls[0][0])).toContain("status IN ('investigating','investigation_failed')");
    await failInvestigation(pool, 'case-1', new Error('gateway unavailable'));
    expect(vi.mocked(pool.query).mock.calls[1][1]).toEqual(expect.arrayContaining(['case-1', expect.stringContaining('gateway unavailable')]));
  });

  it('builds a constrained Korean evidence memo contract', () => {
    const prompt = buildKoreanEvidencePrompt(
      { segment_id: 'SEG-1', conversion_rate: .03 },
      { action: 'ship_proven_variant' },
      { experiment_id: 'EXP-1', lift: .02 },
    );
    expect(prompt).toContain('## 한줄 결론');
    expect(prompt).toContain('## 판단 근거');
    expect(prompt).toContain('## 기대 효과');
    expect(prompt).toContain('## 실행 전 확인사항');
    expect(prompt).toContain('고정 롤아웃 비율을 제안하지 않습니다');
    expect(prompt).toContain('승인, 실행, 기록이 이미 완료되었다고 표현하지 않습니다');
  });

  it('redrafts only a proposed decision and appends a traceable audit event', async () => {
    const pool = Object.create(null) as Pool;
    pool.query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ id: 'case-1', status: 'proposed', drafted_note: '한국어 메모' }] })
      .mockResolvedValueOnce({ rows: [] });
    const updated = await redraftProposedDecision(pool, 'case-1', '한국어 메모', 'run-redraft');
    expect(updated).toMatchObject({ status: 'proposed', drafted_note: '한국어 메모' });
    const firstCall = vi.mocked(pool.query).mock.calls[0];
    expect(String(firstCall[0])).toContain("status='proposed'");
    expect(firstCall[1]).toEqual(expect.arrayContaining([
      'case-1', '한국어 메모', expect.stringContaining('redrafted'),
    ]));
    await expect(redraftProposedDecision(pool, 'case-approved', '메모', 'run-2')).rejects.toThrow(/Invalid redraft state/);
  });
});

describe('search evidence', () => {
  it('returns rows with the declared BM25 index and execution plan', async () => {
    const query = vi.fn().mockResolvedValue({
      rowCount: 1,
      rows: [{ experiment_id: 'EXP-0000009' }],
    });
    const clientQuery = vi.fn()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ 'QUERY PLAN': 'Index Scan using experiments_description_bm25_idx' }] })
      .mockResolvedValueOnce({});
    const pool = Object.create(null) as Pool;
    pool.query = query;
    pool.connect = vi.fn().mockResolvedValue({ query: clientQuery, release: vi.fn() });
    const result = await getSearchExperiments(pool, 'checkout', 5);
    expect(result).toMatchObject({
      search_function: 'app.search_experiments',
      source_table: 'nimbus_serving.experiments',
      source_kind: 'Build 1 continuous sync',
      read_only: true,
      method: 'lakebase_text BM25',
    });
    expect(result.index).toBe('experiments_description_bm25_idx');
    expect(result.execution_plan.join('\n')).toContain('Index Scan');
    expect(result.rows[0]).toMatchObject({ experiment_id: 'EXP-0000009' });
    expect(clientQuery).toHaveBeenNthCalledWith(2, 'SET LOCAL enable_seqscan=off');
  });
});

describe('decision evidence', () => {
  it('returns the app-written row and recovers its assist chain', async () => {
    const pool = Object.create(null) as Pool;
    pool.query = vi.fn().mockResolvedValue({
      rows: [{
        id: 'decision-1',
        segment_id: 'SEG-0000214',
        target_experiment_id: 'EXP-0000009',
        status: 'committed',
        audit_trail: [
          { action: 'proposed', assist_run_id: 'assist-1' },
          { action: 'approved' },
          { action: 'committed' },
        ],
      }],
    });
    const result = await getDecision(pool, 'decision-1');
    expect(result).toMatchObject({
      app_written: true,
      assist_run_id: 'assist-1',
      segment_id: 'SEG-0000214',
      experiment_id: 'EXP-0000009',
      decision_id: 'decision-1',
      row_count: 1,
    });
    expect(result.rows[0].audit_trail).toHaveLength(3);
  });
});

describe('action ranking', () => {
  it('normalizes synced text JSON', () => {
    expect(parseActionRanking('[{"action":"ship_proven_variant"}]')).toEqual([
      { action: 'ship_proven_variant' },
    ]);
  });
});

describe('demo reset', () => {
  it('deletes only the hero segment decision rows', async () => {
    const pool = Object.create(null) as Pool;
    pool.query = vi.fn().mockResolvedValue({ rowCount: 2, rows: [] });
    const result = await resetDemoDecision(pool, 'SEG-0000214');
    expect(result).toMatchObject({
      segment_id: 'SEG-0000214',
      deleted_count: 2,
      synchronized_sources_changed: false,
    });
    expect(pool.query).toHaveBeenCalledWith(
      'DELETE FROM app.feature_decisions_app WHERE segment_id=$1',
      ['SEG-0000214'],
    );
  });

  it('rejects every other segment', async () => {
    const pool = Object.create(null) as Pool;
    pool.query = vi.fn();
    await expect(resetDemoDecision(pool, 'SEG-OTHER')).rejects.toThrow(/restricted/);
    expect(pool.query).not.toHaveBeenCalled();
  });
});
