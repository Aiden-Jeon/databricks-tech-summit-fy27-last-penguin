-- Executed against projects/nimbus-growth-ops/branches/main, database nimbus.
-- Each query returns compact, machine-readable proof used by the companion
-- lakebase_validation.ipynb and lakebase_validation_result.json exports.

SELECT n.nspname AS schema_name, c.relname AS table_name,
       CASE c.relreplident WHEN 'f' THEN 'FULL' WHEN 'd' THEN 'DEFAULT'
            WHEN 'i' THEN 'INDEX' WHEN 'n' THEN 'NOTHING' END AS replica_identity
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE (n.nspname, c.relname) IN
  (('app','decision_forecasts'), ('app','feature_decisions_app'))
ORDER BY 1, 2;

SELECT 'app.decision_forecasts' AS table_name, count(*) AS row_count FROM app.decision_forecasts
UNION ALL
SELECT 'app.feature_decisions_app', count(*) FROM app.feature_decisions_app
ORDER BY 1;

SELECT conrelid::regclass::text AS table_name, conname AS constraint_name,
       CASE contype WHEN 'p' THEN 'PRIMARY KEY' WHEN 'f' THEN 'FOREIGN KEY' END AS constraint_type,
       NULLIF(confrelid, 0)::regclass::text AS references_table
FROM pg_constraint
WHERE conrelid IN ('app.decision_forecasts'::regclass, 'app.feature_decisions_app'::regclass)
  AND contype IN ('p','f')
ORDER BY 1, 2;

SELECT segment_id, forecast_conversion_lift, forecast_conversion_at_risk_usd, rationale
FROM app.decision_forecasts WHERE segment_id = 'SEG-0000214';

BEGIN;
SET LOCAL ROLE nimbus_app_reader;
INSERT INTO app.feature_decisions_app
  (segment_id, action_type, status, drafted_note)
VALUES ('SEG-BUILD1-EVIDENCE', 'ship_proven_variant', 'proposed', 'rolled back proof')
RETURNING segment_id, action_type, status;
ROLLBACK;

BEGIN;
SET LOCAL ROLE nimbus_app_reader;
SELECT segment_id FROM nimbus_serving.segment_positions LIMIT 1;
INSERT INTO nimbus_serving.segment_positions (segment_id) VALUES ('SEG-BUILD1-EVIDENCE');
ROLLBACK;
