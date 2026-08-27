import { describe, expect, it } from 'vitest';
import { assertTransition, parseActionRanking } from './nimbus-runtime.js';

describe('decision state machine', () => {
  it('accepts only proposed -> approved -> committed', () => {
    expect(() => assertTransition('proposed', 'approved', 'vp@example.com')).not.toThrow();
    expect(() => assertTransition('approved', 'committed', 'vp@example.com')).not.toThrow();
    expect(() => assertTransition('proposed', 'committed', null)).toThrow(/Invalid/);
    expect(() => assertTransition('approved', 'committed', null)).toThrow(/approved_by/);
  });
});

describe('action ranking', () => {
  it('normalizes synced text JSON', () => {
    expect(parseActionRanking('[{"action":"ship_proven_variant"}]')).toEqual([
      { action: 'ship_proven_variant' },
    ]);
  });
});
