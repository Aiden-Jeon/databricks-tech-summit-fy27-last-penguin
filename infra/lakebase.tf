terraform {
  required_providers {
    databricks = {
      source  = "databricks/databricks"
      version = ">= 1.99.0"
    }
  }
}

variable "lakebase_branch" {
  type    = string
  default = "projects/nimbus-growth-ops/branches/main"
}

locals {
  synced_tables = {
    segment_positions      = ["sync_segment_positions", "segment_positions", ["segment_id"]]
    open_sliding           = ["sync_open_sliding", "open_sliding", ["segment_id"]]
    action_recommendations = ["sync_action_recommendations", "action_recommendations", ["segment_id"]]
    experiments            = ["sync_experiments", "experiments", ["experiment_id"]]
  }
}

resource "databricks_postgres_synced_table" "nimbus" {
  for_each        = local.synced_tables
  synced_table_id = "last_penguin_catalog.nimbus_serving.${each.value[1]}"

  spec = {
    branch                 = var.lakebase_branch
    postgres_database      = "nimbus"
    source_table_full_name = "last_penguin_catalog.nimbus.${each.value[0]}"
    primary_key_columns    = each.value[2]
    scheduling_policy      = "CONTINUOUS"
    type_overrides = each.key == "experiments" ? [{
      column_name = "description_embedding"
      pg_type     = "PG_SPECIFIC_TYPE_VECTOR"
      size        = 1024
    }] : []
  }
}

resource "databricks_postgres_cdf_config" "nimbus_main_app" {
  parent          = "projects/nimbus-growth-ops/branches/main/databases/db-1yvj-4oxl1t5wrr"
  cdf_config_id   = "nimbus_main_app"
  catalog         = "last_penguin_catalog"
  schema          = "nimbus_reverse"
  postgres_schema = "app"
}
