import { sql } from 'drizzle-orm';
import type { AppDb } from '../index.js';

function rows<T>(result: unknown): T[] {
  const value = result as { rows?: T[] } | T[];
  return Array.isArray(value) ? value : value.rows ?? [];
}

export async function getSlidingSegment(db: AppDb, segmentId: string) {
  const result = await db.execute(sql`
    SELECT sp.*, os.has_matching_experiment, os.matching_experiment_id,
           os.matching_experiment_lift, os.neighbor_flag_key
      FROM nimbus_serving.segment_positions sp
      JOIN nimbus_serving.open_sliding os USING (segment_id)
     WHERE sp.segment_id=${segmentId} LIMIT 1`);
  return rows<Record<string, unknown>>(result)[0] ?? null;
}

export async function worstSlidingSegment(db: AppDb) {
  const result = await db.execute(sql`
    SELECT sp.*, os.has_matching_experiment, os.matching_experiment_id,
           os.matching_experiment_lift, os.neighbor_flag_key
      FROM nimbus_serving.segment_positions sp
      JOIN nimbus_serving.open_sliding os USING (segment_id)
     ORDER BY os.conversion_at_risk_usd DESC, sp.segment_id LIMIT 1`);
  return rows<Record<string, unknown>>(result)[0] ?? null;
}

export async function getRecommendation(db: AppDb, segmentId: string) {
  const result = await db.execute(sql`
    SELECT * FROM nimbus_serving.action_recommendations
     WHERE segment_id=${segmentId} LIMIT 1`);
  return rows<Record<string, unknown>>(result)[0] ?? null;
}

export async function searchExperiments(db: AppDb, query: string, limit = 10) {
  const bounded = Math.min(Math.max(limit, 1), 50);
  const result = await db.execute(sql`
    SELECT * FROM app.search_experiments(${query}, ${bounded})
     ORDER BY relevance DESC, experiment_id`);
  return rows<Record<string, unknown>>(result);
}
