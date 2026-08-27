CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS lakebase_vector;
CREATE EXTENSION IF NOT EXISTS lakebase_text;

CREATE INDEX experiments_description_ann ON nimbus_serving.experiments
USING lakebase_ann (description_embedding vector_cosine_ops);
CREATE INDEX experiments_description_bm25 ON nimbus_serving.experiments
USING lakebase_bm25 (to_tsvector('english', description));

-- The deployed app.search_experiments function retrieves vector and BM25
-- candidates independently, assigns row_number ranks, full-joins by
-- experiment_id, and orders by:
-- 1/(60+vector_rank) + 1/(60+bm25_rank)

