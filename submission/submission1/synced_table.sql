-- Physical Delta sources and keys are defined in sql/01_materialize_sync_sources.sql.
-- Equivalent API-managed continuous synced-table definitions:
-- destination                                    source
-- last_penguin_catalog.nimbus_serving.segment_positions      last_penguin_catalog.nimbus.sync_segment_positions
-- last_penguin_catalog.nimbus_serving.open_sliding           last_penguin_catalog.nimbus.sync_open_sliding
-- last_penguin_catalog.nimbus_serving.action_recommendations last_penguin_catalog.nimbus.sync_action_recommendations
-- last_penguin_catalog.nimbus_serving.experiments            last_penguin_catalog.nimbus.sync_experiments
-- branch=projects/nimbus-growth-ops/branches/main
-- postgres_database=nimbus; scheduling_policy=CONTINUOUS
-- experiments.description_embedding type override=vector(1024)

SELECT 'segment_positions' AS table_name, count(*) FROM nimbus_serving.segment_positions
UNION ALL SELECT 'open_sliding', count(*) FROM nimbus_serving.open_sliding
UNION ALL SELECT 'action_recommendations', count(*) FROM nimbus_serving.action_recommendations
UNION ALL SELECT 'experiments', count(*) FROM nimbus_serving.experiments
ORDER BY table_name;

