import { describe, expect, it, vi } from 'vitest';
import { assertTransition, getSearchExperiments, parseActionRanking } from './nimbus-runtime.js';
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
    const query = vi.fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ experiment_id: 'EXP-0000009' }] })
      .mockResolvedValueOnce({ rows: [{ 'QUERY PLAN': 'Index Scan using experiments_description_bm25_idx' }] });
    const pool = Object.create(null) as Pool;
    pool.query = query;
    const result = await getSearchExperiments(pool, 'checkout', 5);
    expect(result.index).toBe('experiments_description_bm25_idx');
    expect(result.execution_plan.join('\n')).toContain('Index Scan');
    expect(result.rows[0]).toMatchObject({ experiment_id: 'EXP-0000009' });
  });
});

describe('action ranking', () => {
  it('normalizes synced text JSON', () => {
    expect(parseActionRanking('[{"action":"ship_proven_variant"}]')).toEqual([
      { action: 'ship_proven_variant' },
    ]);
  });
});
