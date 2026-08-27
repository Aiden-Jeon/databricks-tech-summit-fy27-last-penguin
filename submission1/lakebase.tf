terraform {
  required_providers {
    databricks = {
      source  = "databricks/databricks"
      version = ">= 1.99.0"
    }
  }
}

resource "databricks_postgres_synced_table" "segment_positions" {
  synced_table_id = "last_penguin_catalog.nimbus_serving.segment_positions"
  spec = {
    branch                 = "projects/nimbus-growth-ops/branches/main"
    postgres_database      = "nimbus"
    source_table_full_name = "last_penguin_catalog.nimbus.sync_segment_positions"
    primary_key_columns    = ["segment_id"]
    scheduling_policy      = "CONTINUOUS"
  }
}

resource "databricks_postgres_synced_table" "open_sliding" {
  synced_table_id = "last_penguin_catalog.nimbus_serving.open_sliding"
  spec = {
    branch                 = "projects/nimbus-growth-ops/branches/main"
    postgres_database      = "nimbus"
    source_table_full_name = "last_penguin_catalog.nimbus.sync_open_sliding"
    primary_key_columns    = ["segment_id"]
    scheduling_policy      = "CONTINUOUS"
  }
}

resource "databricks_postgres_synced_table" "action_recommendations" {
  synced_table_id = "last_penguin_catalog.nimbus_serving.action_recommendations"
  spec = {
    branch                 = "projects/nimbus-growth-ops/branches/main"
    postgres_database      = "nimbus"
    source_table_full_name = "last_penguin_catalog.nimbus.sync_action_recommendations"
    primary_key_columns    = ["segment_id"]
    scheduling_policy      = "CONTINUOUS"
  }
}

resource "databricks_postgres_synced_table" "experiments" {
  synced_table_id = "last_penguin_catalog.nimbus_serving.experiments"
  spec = {
    branch                 = "projects/nimbus-growth-ops/branches/main"
    postgres_database      = "nimbus"
    source_table_full_name = "last_penguin_catalog.nimbus.sync_experiments"
    primary_key_columns    = ["experiment_id"]
    scheduling_policy      = "CONTINUOUS"
    type_overrides = [{
      column_name = "description_embedding"
      pg_type     = "PG_SPECIFIC_TYPE_VECTOR"
      size        = 1024
    }]
  }
}

resource "databricks_postgres_cdf_config" "nimbus_main_app" {
  parent          = "projects/nimbus-growth-ops/branches/main/databases/db-1yvj-4oxl1t5wrr"
  cdf_config_id   = "nimbus_main_app"
  catalog         = "last_penguin_catalog"
  schema          = "nimbus_reverse"
  postgres_schema = "app"
}
