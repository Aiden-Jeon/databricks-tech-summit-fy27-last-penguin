-- Nimbus Build 1: physical Delta sources for continuous UC -> Lakebase sync.
-- The upstream objects are views/materialized views; synced tables require
-- ordinary Delta tables with stable primary keys.

CREATE SCHEMA IF NOT EXISTS last_penguin_catalog.nimbus_serving;

CREATE OR REPLACE TABLE last_penguin_catalog.nimbus.sync_segment_positions
USING DELTA
TBLPROPERTIES ('delta.enableChangeDataFeed' = 'true')
AS
SELECT
  segment_id,
  cohort,
  platform,
  region,
  segment_summary,
  mau,
  conversion_rate,
  conversion_rate_3w_ago,
  conversion_drop,
  sessions,
  CAST(slide_signal_score AS DOUBLE) AS slide_signal_score,
  conv_band,
  conversion_at_risk_usd
FROM last_penguin_catalog.nimbus.gold_segment_position;

ALTER TABLE last_penguin_catalog.nimbus.sync_segment_positions
  ALTER COLUMN segment_id SET NOT NULL;
ALTER TABLE last_penguin_catalog.nimbus.sync_segment_positions
  ADD CONSTRAINT sync_segment_positions_pk PRIMARY KEY (segment_id) NOT ENFORCED;

CREATE OR REPLACE TABLE last_penguin_catalog.nimbus.sync_open_sliding
USING DELTA
TBLPROPERTIES ('delta.enableChangeDataFeed' = 'true')
AS
SELECT * FROM last_penguin_catalog.nimbus.gold_open_sliding;

ALTER TABLE last_penguin_catalog.nimbus.sync_open_sliding
  ALTER COLUMN segment_id SET NOT NULL;
ALTER TABLE last_penguin_catalog.nimbus.sync_open_sliding
  ADD CONSTRAINT sync_open_sliding_pk PRIMARY KEY (segment_id) NOT ENFORCED;

CREATE OR REPLACE TABLE last_penguin_catalog.nimbus.sync_action_recommendations
USING DELTA
TBLPROPERTIES ('delta.enableChangeDataFeed' = 'true')
AS
SELECT
  segment_id,
  recommended_action,
  predicted_conversion_lift,
  predicted_net_value_usd,
  action_ranking,
  scored_at
FROM last_penguin_catalog.nimbus.gold_action_recommendations;

ALTER TABLE last_penguin_catalog.nimbus.sync_action_recommendations
  ALTER COLUMN segment_id SET NOT NULL;
ALTER TABLE last_penguin_catalog.nimbus.sync_action_recommendations
  ADD CONSTRAINT sync_action_recommendations_pk PRIMARY KEY (segment_id) NOT ENFORCED;

CREATE OR REPLACE TABLE last_penguin_catalog.nimbus.sync_experiments
USING DELTA
TBLPROPERTIES ('delta.enableChangeDataFeed' = 'true')
AS
SELECT
  experiment_id,
  experiment_name,
  variant,
  feature_area,
  tested_cohort,
  tested_platform,
  won,
  observed_lift,
  description,
  is_active,
  ai_query('databricks-gte-large-en', description) AS description_embedding
FROM last_penguin_catalog.nimbus.raw_experiments;

ALTER TABLE last_penguin_catalog.nimbus.sync_experiments
  ALTER COLUMN experiment_id SET NOT NULL;
ALTER TABLE last_penguin_catalog.nimbus.sync_experiments
  ADD CONSTRAINT sync_experiments_pk PRIMARY KEY (experiment_id) NOT ENFORCED;

