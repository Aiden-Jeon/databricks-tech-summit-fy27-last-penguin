import type { Pool } from 'pg';

export type ExperimentSearchResult = {
  experimentId: string;
  description: string;
  vectorRank: number | null;
  bm25Rank: number | null;
  fusedRelevance: number;
};

/** Read from the continuously managed synced table; no Delta copy is made. */
export async function searchExperiments(
  pool: Pool,
  query: string,
  queryEmbedding: number[],
  limit = 10,
): Promise<ExperimentSearchResult[]> {
  if (queryEmbedding.length !== 1024) {
    throw new Error(`Expected a 1024-dimensional embedding, received ${queryEmbedding.length}`);
  }
  const vectorLiteral = `[${queryEmbedding.join(',')}]`;
  const result = await pool.query<{
    experiment_id: string;
    description: string;
    vector_rank: string | null;
    bm25_rank: string | null;
    fused_relevance: number;
  }>(
    `SELECT experiment_id, description, vector_rank, bm25_rank, fused_relevance
       FROM app.search_experiments($1, $2::vector(1024), $3)`,
    [query, vectorLiteral, Math.min(Math.max(limit, 1), 50)],
  );
  return result.rows.map((row) => ({
    experimentId: row.experiment_id,
    description: row.description,
    vectorRank: row.vector_rank === null ? null : Number(row.vector_rank),
    bm25Rank: row.bm25_rank === null ? null : Number(row.bm25_rank),
    fusedRelevance: Number(row.fused_relevance),
  }));
}

