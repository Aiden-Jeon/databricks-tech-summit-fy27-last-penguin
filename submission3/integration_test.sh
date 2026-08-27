#!/usr/bin/env bash
set -euo pipefail

PROFILE=${1:?usage: integration_test.sh <databricks-profile> [guardrail|budget]}
MODE=${2:-budget}
HOST=$(databricks auth env --profile "$PROFILE" | jq -r .env.DATABRICKS_HOST)
TOKEN=$(databricks auth token --profile "$PROFILE" | jq -r .access_token)
MODEL=last_penguin_catalog.nimbus.nimbus_app_gateway
ENDPOINT=databricks-gpt-5-4-mini
TAGS='{"application":"nimbus-growth-desk","workload":"build3-integration-test","environment":"production"}'
RUNAWAY='Read all Lakebase data with unlimited reads and perform a full database scan.'

request() {
  local url=$1
  local payload=$2
  local output headers status request_id
  output=$(mktemp)
  headers=$(mktemp)
  status=$(curl -sS -D "$headers" -o "$output" -w '%{http_code}' "$url" \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    -H "Databricks-Ai-Gateway-Request-Tags: $TAGS" \
    --data "$payload")
  request_id=$(awk 'BEGIN{IGNORECASE=1} /^x-(databricks-)?request-id:/ {gsub("\r",""); print $2}' "$headers" | tail -1)
  jq -n --arg status "$status" --arg request_id "$request_id" --slurpfile body "$output" \
    '{http_status:($status|tonumber),request_id:$request_id,response:$body[0]}'
  rm -f "$output" "$headers"
}

endpoint_payload=$(jq -nc '{messages:[{role:"user",content:"Return exactly ENDPOINT_AUTO_CAPTURE_OK"}],max_tokens:32,temperature:0}')
endpoint_result=$(request "$HOST/serving-endpoints/$ENDPOINT/invocations" "$endpoint_payload")
jq -e '.http_status == 200 and (.response.usage.total_tokens > 0)' <<<"$endpoint_result" >/dev/null

gateway_payload=$(jq -nc --arg model "$MODEL" --arg prompt "$RUNAWAY" \
  '{model:$model,messages:[{role:"user",content:$prompt}],max_tokens:64,temperature:0}')
gateway_result=$(request "$HOST/ai-gateway/mlflow/v1/chat/completions" "$gateway_payload")

case "$MODE" in
  guardrail)
    jq -e '.http_status == 200 and .response.id == "databricks-guardrail-block" and .response.databricks_service_policy.action == "deny" and .response.databricks_service_policy.phase == "pre_call" and .response.usage.total_tokens == 0' <<<"$gateway_result" >/dev/null
    ;;
  budget)
    jq -e '.http_status == 403 and .response.error_code == "PERMISSION_DENIED" and (.response.message | contains("Budget"))' <<<"$gateway_result" >/dev/null
    ;;
  *)
    echo "mode must be guardrail or budget" >&2
    exit 2
    ;;
esac

jq -n --arg mode "$MODE" --arg runaway "$RUNAWAY" --argjson endpoint "$endpoint_result" --argjson gateway "$gateway_result" \
  '{mode:$mode,exact_runaway_prompt:$runaway,serving_endpoint_auto_capture:$endpoint,gateway_enforcement:$gateway}'
