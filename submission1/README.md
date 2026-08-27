# Nimbus Lakebase Build 1 evidence map

This directory is the complete Build 1 submission. It intentionally contains both
the build constructs and raw execution evidence needed to verify them.

| Requirement | Build construct | Execution evidence |
|---|---|---|
| UC to Lakebase continuous sync as code | `lakebase.tf` (`databricks_postgres_synced_table`) | `synced_table_result.json`, `sync_status.json`, `terraform_validation.txt` |
| Reverse Lakehouse Sync as code | `lakebase.tf` (`databricks_postgres_cdf_config`) | `reverse_sync_sample.json`, `sync_status.json` |
| Named development branch from main | `lakebase_setup.sh` (`create-branch ... agent-forecast-dev`) | `infrastructure_result.json`, `branch.txt` |
| Scale to zero | `lakebase_setup.sh` (`suspend_timeout_duration: 300s`) | `infrastructure_result.json` (`current_state: IDLE`, `suspend_timeout_duration: 300s`) |
| Related operational tables and keys | `agent_change/001_decision_forecasts.sql` | `runtime_schema_result.json`, `agent_change/validation.txt` |
| Writable operational/read-only synced split | migration plus grants in the committed SQL | `runtime_schema_result.json`, `synced_table_result.json` |
| Validated promotion into main | migration commit `3f59ebb` and merge commit `fffbc5e` | `merge_evidence.txt`, `git_history.txt` |

No credentials or OAuth tokens are included.
