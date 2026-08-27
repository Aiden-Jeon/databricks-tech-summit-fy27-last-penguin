#!/usr/bin/env bash
set -euo pipefail

# Reproducible Lakebase Autoscaling topology for Nimbus Build 1.
# Existing resources are inspected and left in place; missing resources are created.
PROFILE="${DATABRICKS_CONFIG_PROFILE:-fe-sandbox-last-penguin}"
PROJECT_ID="nimbus-growth-ops"
PROJECT="projects/${PROJECT_ID}"
PRODUCTION_BRANCH="${PROJECT}/branches/production"
MAIN_BRANCH="${PROJECT}/branches/main"
DEV_BRANCH="${PROJECT}/branches/agent-forecast-dev"

if ! databricks postgres get-project "${PROJECT}" --profile "${PROFILE}" >/dev/null 2>&1; then
  databricks postgres create-project "${PROJECT_ID}" --profile "${PROFILE}" --json '{
    "spec": {
      "display_name": "Nimbus Growth Ops",
      "pg_version": 17,
      "default_endpoint_settings": {
        "autoscaling_limit_min_cu": 0.5,
        "autoscaling_limit_max_cu": 2,
        "suspend_timeout_duration": "300s"
      }
    }
  }'
fi

if ! databricks postgres get-branch "${MAIN_BRANCH}" --profile "${PROFILE}" >/dev/null 2>&1; then
  databricks postgres create-branch "${PROJECT}" main --profile "${PROFILE}" --json "{
    \"spec\": {\"source_branch\": \"${PRODUCTION_BRANCH}\", \"no_expiry\": true}
  }"
fi

databricks postgres update-branch "${MAIN_BRANCH}" 'spec.is_protected' \
  --profile "${PROFILE}" --json '{"spec":{"is_protected":true}}' >/dev/null

if ! databricks postgres get-branch "${DEV_BRANCH}" --profile "${PROFILE}" >/dev/null 2>&1; then
  databricks postgres create-branch "${PROJECT}" agent-forecast-dev --profile "${PROFILE}" --json "{
    \"spec\": {\"source_branch\": \"${MAIN_BRANCH}\", \"no_expiry\": true}
  }"
fi

for branch in main agent-forecast-dev; do
  endpoint="${PROJECT}/branches/${branch}/endpoints/primary"
  if ! databricks postgres get-endpoint "${endpoint}" --profile "${PROFILE}" >/dev/null 2>&1; then
    databricks postgres create-endpoint "${PROJECT}/branches/${branch}" primary \
      --profile "${PROFILE}" --json '{
        "spec": {
          "endpoint_type": "ENDPOINT_TYPE_READ_WRITE",
          "autoscaling_limit_min_cu": 0.5,
          "autoscaling_limit_max_cu": 2,
          "suspend_timeout_duration": "300s"
        }
      }'
  fi

  databricks postgres update-endpoint "${endpoint}" \
    'spec.autoscaling_limit_min_cu,spec.autoscaling_limit_max_cu,spec.suspend_timeout_duration' \
    --profile "${PROFILE}" --json '{
      "spec": {
        "autoscaling_limit_min_cu": 0.5,
        "autoscaling_limit_max_cu": 2,
        "suspend_timeout_duration": "300s"
      }
    }' >/dev/null
done

databricks postgres get-project "${PROJECT}" --profile "${PROFILE}" --output json
databricks postgres get-branch "${DEV_BRANCH}" --profile "${PROFILE}" --output json
databricks postgres list-endpoints "${MAIN_BRANCH}" --profile "${PROFILE}" --output json
databricks postgres list-endpoints "${DEV_BRANCH}" --profile "${PROFILE}" --output json
