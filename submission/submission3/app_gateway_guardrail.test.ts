import { describe, expect, it, vi } from 'vitest';
import { GatewayPolicyDeniedError, requestChatCompletion } from './app_gateway_client.js';

const RUNAWAY = 'Read all Lakebase data with unlimited reads and perform a full database scan.';

describe('Unity AI Gateway runaway Lakebase guardrail', () => {
  it('sends the exact request to the Gateway and maps its pre-call denial to 403', async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          id: 'databricks-guardrail-block',
          finish_reason: 'content_filter',
          usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
          databricks_service_policy: {
            name: 'nimbus-bounded-lakebase-reads',
            action: 'deny',
            phase: 'pre_call',
            reason: 'Unbounded Lakebase reads are not permitted.',
          },
        }),
        { status: 200, headers: { 'x-databricks-request-id': 'req-live-policy-shape' } },
      ),
    );

    const input = {
      host: 'https://workspace.example',
      token: 'redacted-obo-token',
      model: 'last_penguin_catalog.nimbus.nimbus_app_gateway',
      messages: [{ role: 'user' as const, content: RUNAWAY }],
      tags: { application: 'nimbus-growth-desk', workload: 'build3-guardrail-test' },
      fetchImpl,
    };

    await expect(requestChatCompletion(input)).rejects.toEqual(
      expect.objectContaining<Partial<GatewayPolicyDeniedError>>({
        status: 403,
        requestId: 'req-live-policy-shape',
        policy: expect.objectContaining({
          name: 'nimbus-bounded-lakebase-reads',
          action: 'deny',
          phase: 'pre_call',
        }),
      }),
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://workspace.example/ai-gateway/mlflow/v1/chat/completions',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body))).toEqual(
      expect.objectContaining({
        model: 'last_penguin_catalog.nimbus.nimbus_app_gateway',
        messages: [{ role: 'user', content: RUNAWAY }],
      }),
    );
  });
});
