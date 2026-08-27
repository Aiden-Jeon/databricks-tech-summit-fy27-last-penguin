import { describe, expect, it, vi } from 'vitest';
import { GatewayHttpError, GatewayPolicyDeniedError, requestChatCompletion } from './ai-gateway.js';

const baseInput = {
  host: 'https://workspace.example',
  token: 'obo-token',
  model: 'catalog.schema.nimbus_app_gateway',
  messages: [{ role: 'user' as const, content: 'bounded request' }],
  tags: { application: 'nimbus-growth-desk', segment_id: 'SEG-1' },
};

describe('requestChatCompletion', () => {
  it('uses the Unity AI Gateway route and attribution tags', async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), {
      status: 200,
      headers: { 'content-type': 'application/json', 'x-request-id': 'req-ok' },
    }));
    const result = await requestChatCompletion({ ...baseInput, fetchImpl });
    expect(result.requestId).toBe('req-ok');
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://workspace.example/ai-gateway/mlflow/v1/chat/completions',
      expect.objectContaining({ method: 'POST' }),
    );
    const init = fetchImpl.mock.calls[0][1];
    expect(init).toBeDefined();
    if (!init) throw new Error('missing fetch request options');
    expect((init.headers as Record<string, string>)['Databricks-Ai-Gateway-Request-Tags']).toContain('SEG-1');
  });

  it.each([403, 429])('preserves Gateway status %s and request ID without leaking arbitrary fields', async (status) => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify({
      error_code: status === 403 ? 'POLICY_VIOLATION' : 'BUDGET_EXCEEDED',
      message: 'request blocked',
      internal_debug: 'secret detail',
    }), { status, headers: { 'x-databricks-request-id': `req-${status}` } }));
    await expect(requestChatCompletion({ ...baseInput, fetchImpl })).rejects.toEqual(
      expect.objectContaining<Partial<GatewayHttpError>>({
        status,
        requestId: `req-${status}`,
        body: { error_code: status === 403 ? 'POLICY_VIOLATION' : 'BUDGET_EXCEEDED', message: 'request blocked' },
      }),
    );
  });

  it('treats a structured HTTP 200 service-policy denial as blocked before inference', async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify({
      id: 'databricks-guardrail-block',
      databricks_service_policy: {
        name: 'nimbus-bounded-lakebase-reads', action: 'deny', phase: 'pre_call', reason: 'bounded reads required',
      },
      usage: { total_tokens: 0 },
    }), { status: 200, headers: { 'x-request-id': 'req-policy' } }));
    await expect(requestChatCompletion({ ...baseInput, fetchImpl })).rejects.toEqual(
      expect.objectContaining<Partial<GatewayPolicyDeniedError>>({
        status: 403,
        requestId: 'req-policy',
        policy: expect.objectContaining({ action: 'deny', phase: 'pre_call' }),
      }),
    );
  });
});
