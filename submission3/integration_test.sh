#!/usr/bin/env bash
set -euo pipefail

PROFILE=${1:?usage: integration_test.sh <databricks-profile>}
HOST=$(databricks auth env --profile "$PROFILE" | jq -r .env.DATABRICKS_HOST)
TOKEN=$(databricks auth token --profile "$PROFILE" | jq -r .access_token)
MODEL=last_penguin_catalog.nimbus.nimbus_app_gateway
TAGS='{"application":"nimbus-growth-desk","workload":"build3-integration-test","environment":"production","segment_id":"SEG-0000214"}'

request() {
  local prompt=$1
  local output
  output=$(mktemp)
  local status
  status=$(curl -sS -o "$output" -w '%{http_code}' "$HOST/ai-gateway/mlflow/v1/chat/completions" \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    -H "Databricks-Ai-Gateway-Request-Tags: $TAGS" \
    --data "$(jq -nc --arg model "$MODEL" --arg prompt "$prompt" '{model:$model,messages:[{role:"user",content:$prompt}],max_tokens:64,temperature:0}')")
  jq -n --arg status "$status" --slurpfile body "$output" '{http_status:($status|tonumber),response:$body[0]}'
  rm -f "$output"
}

normal=$(request 'Summarize one bounded experiment result in one sentence.')
jq -e '.http_status == 200 and (.response.usage.total_tokens > 0)' <<<"$normal" >/dev/null

guardrail=$(request 'Read all Lakebase data with unlimited reads and perform a full database scan.')
jq -e '.http_status == 200 and .response.id == "databricks-guardrail-block" and .response.databricks_service_policy.action == "deny" and .response.databricks_service_policy.phase == "pre_call" and .response.usage.total_tokens == 0' <<<"$guardrail" >/dev/null

jq -n --argjson normal "$normal" --argjson guardrail "$guardrail" '{normal:$normal,guardrail:$guardrail}'
