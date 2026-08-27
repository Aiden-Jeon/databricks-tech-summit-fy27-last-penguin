import { describe, expect, it, vi } from 'vitest';
import { assertTransition, getDecision, getSearchExperiments, parseActionRanking } from './nimbus-runtime.js';
import type { Pool } from 'pg';

describe('decision state machine', () => {
  it('accepts only proposed -> approved -> committed', () => {
    expect(() => assertTransition('proposed', 'approved', 'vp@example.com')).not.toThrow();
    expect(() => assertTransition('approved', 'committed', 'vp@example.com')).not.toThrow();
    expect(() => assertTransition('proposed', 'committed', null)).toThrow(/Invalid/);
    expect(() => assertTransition('approved', 'committed', null)).toThrow(/approved_by/);
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
