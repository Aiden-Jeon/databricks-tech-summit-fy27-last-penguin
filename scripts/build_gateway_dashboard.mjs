import { mkdirSync, writeFileSync } from 'node:fs';

const output = new URL('../submission/presentation/support/Nimbus_AI_Gateway_Dashboard.json', import.meta.url);
mkdirSync(new URL('.', output), { recursive: true });

const base = `WITH usage_base AS (
  SELECT event_time,
         CASE
           WHEN COALESCE(service_name, endpoint_name) = 'last_penguin_catalog.nimbus.nimbus_app_gateway' THEN 'App Gateway'
           WHEN COALESCE(service_name, endpoint_name) = 'last_penguin_catalog.nimbus.nimbus_coding_agent_gateway' THEN 'Coding Agent Gateway'
           ELSE COALESCE(service_name, endpoint_name)
         END AS gateway,
         COALESCE(destination_model, destination_name, '(no destination)') AS model,
         COALESCE(request_tags['application'], endpoint_tags['application'], 'unattributed') AS application,
         status_code, requester, request_id,
         COALESCE(input_tokens, 0) AS input_tokens,
         COALESCE(output_tokens, 0) AS output_tokens,
         COALESCE(total_tokens, COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0)) AS total_tokens,
         COALESCE(input_tokens, 0) / 1000000.0 * 0.15
           + COALESCE(output_tokens, 0) / 1000000.0 * 0.60 AS est_cost_usd
  FROM usage
  WHERE workspace_id = '7474655051393778'
    AND COALESCE(service_name, endpoint_name) IN (
      'last_penguin_catalog.nimbus.nimbus_app_gateway',
      'last_penguin_catalog.nimbus.nimbus_coding_agent_gateway'
    )
)`;

const datasets = [
  {
    name: 'summary', displayName: '비용 및 통제 요약',
    queryLines: [`${base}\nSELECT ROUND(SUM(est_cost_usd), 6) AS est_cost_usd,\n`,
      `       COUNT(*) AS requests, SUM(total_tokens) AS total_tokens,\n`,
      `       SUM(CASE WHEN status_code = 403 THEN 1 ELSE 0 END) AS blocked_403,\n`,
      `       CAST(0.03 AS DOUBLE) AS alert_usd, CAST(0.05 AS DOUBLE) AS hard_stop_usd,\n`,
      `       (SELECT ROUND(SUM(usage_quantity), 6) FROM external_model_spend\n`,
      `         WHERE workspace_id = '7474655051393778'\n`,
      `           AND usage_metadata.endpoint_name IN ('last_penguin_catalog.nimbus.nimbus_app_gateway','last_penguin_catalog.nimbus.nimbus_coding_agent_gateway')) AS external_model_spend_usd\n`,
      `FROM usage_base`],
  },
  {
    name: 'hourly', displayName: '시간별 추정 비용',
    queryLines: [`${base}\nSELECT DATE_TRUNC('HOUR', event_time) AS hour, gateway,\n`,
      `       ROUND(SUM(est_cost_usd), 6) AS est_cost_usd, SUM(total_tokens) AS total_tokens, COUNT(*) AS requests\n`,
      `FROM usage_base GROUP BY 1,2 ORDER BY 1`],
  },
  {
    name: 'gateway_model', displayName: 'Gateway 및 모델별 사용량',
    queryLines: [`${base}\nSELECT gateway, model, ROUND(SUM(est_cost_usd), 6) AS est_cost_usd,\n`,
      `       SUM(total_tokens) AS total_tokens, COUNT(*) AS requests\n`,
      `FROM usage_base GROUP BY 1,2 ORDER BY est_cost_usd DESC`],
  },
  {
    name: 'request_log', displayName: '최근 Gateway 요청',
    queryLines: [`${base}\nSELECT event_time, gateway, model, application, status_code, requester, request_id,\n`,
      `       input_tokens, output_tokens, total_tokens, ROUND(est_cost_usd, 6) AS est_cost_usd\n`,
      `FROM usage_base ORDER BY event_time DESC LIMIT 100`],
  },
];

const numberFormat = { type: 'number', abbreviation: 'compact', decimalPlaces: { type: 'max', places: 1 } };
const currencyFormat = { type: 'number-currency', currencyCode: 'USD', decimalPlaces: { type: 'exact', places: 4 } };

function counter(name, datasetName, field, title, position, format) {
  return {
    widget: {
      name,
      queries: [{ name: 'main_query', query: { datasetName, fields: [{ name: field, expression: `\`${field}\`` }], disaggregated: true } }],
      spec: { version: 2, widgetType: 'counter', encodings: { value: { fieldName: field, displayName: title, ...(format ? { format } : {}) } }, frame: { showTitle: true, title } },
    },
    position,
  };
}

const layout = [
  { widget: { name: 'title', multilineTextboxSpec: { lines: ['## AI 비용은 보이고, 귀속되고, 멈춥니다'] } }, position: { x: 0, y: 0, width: 12, height: 1 } },
  { widget: { name: 'subtitle', multilineTextboxSpec: { lines: ['Nimbus Growth Desk · 명시 단가 기준 추정 비용(입력 $0.15/M, 출력 $0.60/M) · application/requester/request ID 귀속 · $0.03 알림 / $0.05 하드 스톱'] } }, position: { x: 0, y: 1, width: 12, height: 1 } },
  counter('estimated-cost', 'summary', 'est_cost_usd', '추정 토큰 비용', { x: 0, y: 2, width: 2, height: 3 }, currencyFormat),
  counter('request-count', 'summary', 'requests', '요청 수', { x: 2, y: 2, width: 2, height: 3 }, numberFormat),
  counter('total-tokens', 'summary', 'total_tokens', '총 토큰', { x: 4, y: 2, width: 2, height: 3 }, numberFormat),
  counter('blocked-count', 'summary', 'blocked_403', '403 차단', { x: 6, y: 2, width: 2, height: 3 }),
  counter('alert-threshold', 'summary', 'alert_usd', '데모 알림', { x: 8, y: 2, width: 2, height: 3 }, currencyFormat),
  counter('hard-stop-threshold', 'summary', 'hard_stop_usd', '하드 스톱', { x: 10, y: 2, width: 2, height: 3 }, currencyFormat),
  { widget: { name: 'billing-note', multilineTextboxSpec: { lines: ['**비용 해석:** 위 금액은 데모에서 명시한 토큰 단가에 따른 추정치입니다. `external_model_spend`에 Nimbus 행이 없으면 실제 외부 모델 spend는 0달러가 아니라 **미제공(NULL)** 입니다. $0.03/$0.05는 데모 검증 임계값이며 연간 비용 상한이 아닙니다.'] } }, position: { x: 0, y: 5, width: 12, height: 2 } },
  {
    widget: {
      name: 'hourly-cost',
      queries: [{ name: 'main_query', query: { datasetName: 'hourly', fields: [
        { name: 'hour', expression: '`hour`' }, { name: 'est_cost_usd', expression: '`est_cost_usd`' }, { name: 'gateway', expression: '`gateway`' },
      ], disaggregated: true } }],
      spec: { version: 3, widgetType: 'line', encodings: { x: { fieldName: 'hour', scale: { type: 'temporal' } }, y: { fieldName: 'est_cost_usd', displayName: '추정 비용 (USD)', scale: { type: 'quantitative', domainMin: 0 }, format: currencyFormat }, color: { fieldName: 'gateway', scale: { type: 'categorical' } } }, frame: { showTitle: true, title: '시간별 추정 비용' } },
    }, position: { x: 0, y: 7, width: 6, height: 6 },
  },
  {
    widget: {
      name: 'gateway-model-usage',
      queries: [{ name: 'main_query', query: { datasetName: 'gateway_model', fields: [
        { name: 'gateway', expression: '`gateway`' }, { name: 'total_tokens', expression: '`total_tokens`' }, { name: 'model', expression: '`model`' },
      ], disaggregated: true } }],
      spec: { version: 3, widgetType: 'bar', mark: { layout: 'group' }, encodings: { x: { fieldName: 'total_tokens', displayName: '총 토큰', scale: { type: 'quantitative' }, format: numberFormat }, y: { fieldName: 'gateway', scale: { type: 'categorical' } }, color: { fieldName: 'model', scale: { type: 'categorical' } } }, frame: { showTitle: true, title: 'Gateway · 모델별 사용량' } },
    }, position: { x: 6, y: 7, width: 6, height: 6 },
  },
  {
    widget: {
      name: 'recent-requests',
      queries: [{ name: 'main_query', query: { datasetName: 'request_log', fields: [
        'event_time','application','gateway','model','status_code','requester','request_id','total_tokens','est_cost_usd',
      ].map((field) => ({ name: field, expression: `\`${field}\`` })), disaggregated: true } }],
      spec: { version: 2, widgetType: 'table', encodings: { columns: [
        ['event_time','시각'],['application','애플리케이션'],['gateway','Gateway'],['model','모델'],['status_code','상태'],['requester','요청자'],['request_id','요청 ID'],['total_tokens','토큰'],['est_cost_usd','추정 USD'],
      ].map(([fieldName, displayName]) => ({ fieldName, displayName })) }, frame: { showTitle: true, title: '최근 요청 로그 · 귀속 및 차단 결과' } },
    }, position: { x: 0, y: 13, width: 12, height: 7 },
  },
];

const dashboard = {
  datasets,
  pages: [{ name: 'overview', displayName: 'Gateway 비용 통제', pageType: 'PAGE_TYPE_CANVAS', layoutVersion: 'GRID_V1', layout }],
  uiSettings: { theme: {
    canvasBackgroundColor: { light: '#F5F7FB', dark: '#182026' },
    widgetBackgroundColor: { light: '#FFFFFF', dark: '#11171C' },
    widgetBorderColor: { light: '#FFFFFF', dark: '#11171C' },
    fontColor: { light: '#1F2530', dark: '#E8ECF0' },
    selectionColor: { light: '#4F7CE3', dark: '#8ACAFF' },
    visualizationColors: ['#094074','#3C6997','#5ADBFF','#FFDD4A','#FE9000','#2F9E6F'],
    widgetHeaderAlignment: 'LEFT', fontFamily: 'Noto Sans KR', widgetCornerRadius: 10,
  } },
};

writeFileSync(output, `${JSON.stringify(dashboard, null, 2)}\n`);
console.log(output.pathname);
