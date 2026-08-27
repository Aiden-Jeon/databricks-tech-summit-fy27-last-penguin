# Nimbus Lakebase Build 1 evidence map

This directory is the complete Build 1 submission. It intentionally contains both
the build constructs and raw execution evidence needed to verify them.

| Requirement | Build construct | Execution evidence |
|---|---|---|
| Lakebase project, branch, endpoint topology as code | `databricks.yml` (`postgres_projects`, `postgres_branches`, `postgres_endpoints`) | `infrastructure_result.json`, `branch.txt` |
| UC to Lakebase continuous sync as code | `databricks.yml` and four explicit `databricks_postgres_synced_table` resources in `lakebase.tf` | `synced_table_result.json`, `sync_status.json`, `terraform_validation.txt` |
| Reverse Lakehouse Sync as code | `lakebase.tf` (`databricks_postgres_cdf_config`) | `reverse_sync_sample.json`, `sync_status.json` |
| Named development branch from main | `databricks.yml` and `lakebase_setup.sh` | `infrastructure_result.json`, `branch.txt` |
| Scale to zero at 0.5–2 CU | literal endpoint specs in `databricks.yml` | `infrastructure_result.json` (`current_state: IDLE`, `suspend_timeout_duration: 300s`) |
| Related operational tables, keys, rows, and replica identity | `agent_change/001_decision_forecasts.sql`, `lakebase_validation.sql` | executed `lakebase_validation.ipynb`, `lakebase_validation_result.json` |
| Forecast row for `SEG-0000214` | `agent_change/001_decision_forecasts.sql` | executed `lakebase_validation.ipynb`, `lakebase_validation_result.json` |
| Writable operational/read-only synced split | migration grants and `lakebase_validation.sql` | executed `lakebase_validation.ipynb`, `lakebase_validation_result.json`, `transactional_write_test.txt` |
| Validated GitHub promotion into main | migration commit `3f59ebb` and promotion PR | `agent_change/promotion_pr.json`, `git_history.txt` |

No credentials or OAuth tokens are included.
