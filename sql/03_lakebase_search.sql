-- Lakebase Search extensions must be installed in this order.
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS lakebase_vector;
CREATE EXTENSION IF NOT EXISTS lakebase_text;

CREATE INDEX IF NOT EXISTS experiments_description_ann
  ON nimbus_serving.experiments
  USING lakebase_ann (description_embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS experiments_description_bm25
  ON nimbus_serving.experiments
  USING lakebase_bm25 (to_tsvector('english', description));

-- RRF combines independent ANN and BM25 ranks. The application supplies the
-- same 1024-dimensional query embedding model used for the Delta source.
CREATE OR REPLACE FUNCTION app.search_experiments(
  query_text text,
  query_embedding vector(1024),
  result_limit integer DEFAULT 10
) RETURNS TABLE (
  experiment_id text,
  description text,
  vector_rank bigint,
  bm25_rank bigint,
  fused_relevance double precision
) LANGUAGE sql STABLE AS $$
WITH vector_candidates AS (
  SELECT e.experiment_id,
         row_number() OVER (ORDER BY e.description_embedding <=> query_embedding) AS rank
  FROM nimbus_serving.experiments e
  ORDER BY e.description_embedding <=> query_embedding
  LIMIT 50
),
bm25_candidates AS (
  SELECT e.experiment_id,
         row_number() OVER (
           ORDER BY to_tsvector('english', e.description)
             <@> to_bm25query(
                    to_tsvector('english', query_text),
                    'nimbus_serving.experiments_description_bm25'::regclass)
         ) AS rank
  FROM nimbus_serving.experiments e
  ORDER BY to_tsvector('english', e.description)
             <@> to_bm25query(
                    to_tsvector('english', query_text),
                    'nimbus_serving.experiments_description_bm25'::regclass)
  LIMIT 50
),
fused AS (
  SELECT COALESCE(v.experiment_id, b.experiment_id) AS experiment_id,
         v.rank AS vector_rank,
         b.rank AS bm25_rank,
         COALESCE(1.0 / (60 + v.rank), 0.0) +
         COALESCE(1.0 / (60 + b.rank), 0.0) AS fused_relevance
  FROM vector_candidates v
  FULL OUTER JOIN bm25_candidates b USING (experiment_id)
)
SELECT e.experiment_id, e.description, f.vector_rank, f.bm25_rank, f.fused_relevance
FROM fused f
JOIN nimbus_serving.experiments e USING (experiment_id)
ORDER BY f.fused_relevance DESC, e.experiment_id
LIMIT result_limit;
$$;
