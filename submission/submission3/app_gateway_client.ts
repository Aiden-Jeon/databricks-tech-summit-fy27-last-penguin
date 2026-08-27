const SAFE_ERROR_FIELDS = ['error', 'error_code', 'message', 'policy', 'type'] as const;

export class GatewayHttpError extends Error {
  constructor(
    readonly status: number,
    readonly requestId: string | null,
    readonly body: Record<string, unknown>,
  ) {
    super(typeof body.message === 'string' ? body.message : `AI Gateway request failed (${status})`);
    this.name = 'GatewayHttpError';
  }
}

export class GatewayPolicyDeniedError extends Error {
  readonly status = 403;

  constructor(
    readonly requestId: string | null,
    readonly policy: Record<string, unknown>,
  ) {
    super(typeof policy.reason === 'string' ? policy.reason : 'AI Gateway service policy denied the request');
    this.name = 'GatewayPolicyDeniedError';
  }
}

function safeErrorBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  return Object.fromEntries(SAFE_ERROR_FIELDS.flatMap((key) => {
    const field = source[key];
    return typeof field === 'string' || typeof field === 'number' ? [[key, field]] : [];
  }));
}

export async function requestChatCompletion(input: {
  host: string;
  token: string;
  model: string;
  messages: Array<{ role: 'system' | 'user'; content: string }>;
  tags: Record<string, string>;
  maxTokens?: number;
  temperature?: number;
  fetchImpl?: typeof fetch;
}) {
  const fetchImpl = input.fetchImpl ?? fetch;
  const normalizedHost = /^https?:\/\//i.test(input.host) ? input.host : `https://${input.host}`;
  const response = await fetchImpl(`${normalizedHost.replace(/\/$/, '')}/ai-gateway/mlflow/v1/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${input.token}`,
      'content-type': 'application/json',
      'Databricks-Ai-Gateway-Request-Tags': JSON.stringify(input.tags),
    },
    body: JSON.stringify({
      model: input.model,
      messages: input.messages,
      max_tokens: input.maxTokens ?? 500,
      temperature: input.temperature ?? 0.2,
    }),
  });
  const requestId = response.headers.get('x-request-id') ?? response.headers.get('x-databricks-request-id');
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new GatewayHttpError(response.status, requestId, safeErrorBody(body));
  const policy = body.databricks_service_policy;
  if (policy && typeof policy === 'object' && !Array.isArray(policy) && (policy as Record<string, unknown>).action === 'deny') {
    throw new GatewayPolicyDeniedError(requestId, policy as Record<string, unknown>);
  }
  return {body, requestId};
}
