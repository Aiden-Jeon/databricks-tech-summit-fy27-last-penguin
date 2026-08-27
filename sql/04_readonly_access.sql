-- Application access boundary: managed sync tables are SELECT-only.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nimbus_app_reader') THEN
    CREATE ROLE nimbus_app_reader NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA nimbus_serving TO nimbus_app_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA nimbus_serving TO nimbus_app_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA nimbus_serving
  GRANT SELECT ON TABLES TO nimbus_app_reader;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON ALL TABLES IN SCHEMA nimbus_serving FROM nimbus_app_reader;

GRANT USAGE ON SCHEMA app TO nimbus_app_reader;
GRANT SELECT, INSERT, UPDATE ON app.feature_decisions_app TO nimbus_app_reader;
GRANT SELECT ON app.decision_forecasts TO nimbus_app_reader;

