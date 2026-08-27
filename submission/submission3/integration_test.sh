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
BOUNDED='Summarize one bounded experiment result in one sentence.'

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
  jq -n --arg status "$status" --arg request_id "$request_id" --rawfile raw_body "$output" \
    '{http_status:($status|tonumber),request_id:$request_id,response:(try ($raw_body|fromjson) catch {raw:$raw_body})}'
  rm -f "$output" "$headers"
}

endpoint_payload=$(jq -nc '{messages:[{role:"user",content:"Return exactly ENDPOINT_AUTO_CAPTURE_OK"}],max_tokens:32,temperature:0}')
endpoint_result=$(request "$HOST/serving-endpoints/$ENDPOINT/invocations" "$endpoint_payload")
jq -e 'type == "object" and .http_status == 200 and (.response.usage.total_tokens > 0)' <<<"$endpoint_result" >/dev/null

gateway_prompt=$RUNAWAY
if [[ "$MODE" == budget ]]; then
  gateway_prompt=$BOUNDED
fi
gateway_payload=$(jq -nc --arg model "$MODEL" --arg prompt "$gateway_prompt" \
  '{model:$model,messages:[{role:"user",content:$prompt}],max_tokens:64,temperature:0}')
gateway_result=$(request "$HOST/ai-gateway/mlflow/v1/chat/completions" "$gateway_payload")

result=$(jq -n --arg mode "$MODE" --arg prompt "$gateway_prompt" --argjson endpoint "$endpoint_result" --argjson gateway "$gateway_result" \
  '{mode:$mode,exact_test_prompt:$prompt,serving_endpoint_auto_capture:$endpoint,gateway_enforcement:$gateway}')

case "$MODE" in
  guardrail)
    if ! jq -e '.gateway_enforcement.http_status == 200 and .gateway_enforcement.response.id == "databricks-guardrail-block" and .gateway_enforcement.response.databricks_service_policy.action == "deny" and .gateway_enforcement.response.databricks_service_policy.phase == "pre_call" and .gateway_enforcement.response.usage.total_tokens == 0' <<<"$result" >/dev/null; then
      jq . <<<"$result" >&2
      exit 1
    fi
    ;;
  budget)
    if ! jq -e '.gateway_enforcement.http_status == 403 and .gateway_enforcement.response.error_code == "PERMISSION_DENIED" and (.gateway_enforcement.response.message | contains("Budget"))' <<<"$result" >/dev/null; then
      jq . <<<"$result" >&2
      exit 1
    fi
    ;;
  *)
    echo "mode must be guardrail or budget" >&2
    exit 2
    ;;
esac

jq . <<<"$result"
