import express from 'express';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { createApp, lakebase, server } from '@databricks/appkit';
import {
  HERO_EXPERIMENT_ID,
  HERO_SEGMENT_ID,
  createProposedDecision,
  getLiveView,
  initializeDecisionSchema,
  parseActionRanking,
  transitionDecision,
} from './nimbus-runtime.js';
import { GatewayHttpError, GatewayPolicyDeniedError, requestChatCompletion } from './lib/ai-gateway.js';

function actor(req: express.Request) {
  return req.header('x-forwarded-email') || req.header('x-forwarded-user') || 'local-operator@nimbus.test';
}

function sendError(res: express.Response, error: unknown) {
  if (error instanceof GatewayPolicyDeniedError) {
    res.status(error.status).json({
      error: error.message,
      request_id: error.requestId,
      upstream_status: 200,
      databricks_service_policy: error.policy,
    });
    return;
  }
  if (error instanceof GatewayHttpError) {
    res.status(error.status).json({ ...error.body, request_id: error.requestId });
    return;
  }
  const message = error instanceof Error ? error.message : String(error);
  const status = /not found/i.test(message) ? 404 : /Invalid|required|Missing/i.test(message) ? 409 : 500;
  res.status(status).json({ error: message });
}

function registerRoutes(app: express.Application, pool: Pool) {
app.use(express.json({ limit: '1mb' }));

app.get('/api/runtime-health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected', checked_at: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ status: 'error', database: 'unavailable', detail: String(error) });
  }
});

app.get('/api/me', (req, res) => res.json({
  userName: actor(req), userEmail: actor(req), workspaceUrl: process.env.DATABRICKS_HOST ?? '',
  workspaceId: process.env.DATABRICKS_WORKSPACE_ID ?? null, isUserContext: Boolean(req.header('x-forwarded-email')),
}));

app.get('/api/config', (_req, res) => res.json({
  mlflowExperimentId: null, agentMlflowExperimentId: null, dashboardId: '',
  branding: { appName: 'Nimbus Growth Desk' },
  assistantScript: [
    { label: 'Investigate + draft', prompt: `Why is ${HERO_SEGMENT_ID} sliding and what should ship?` },
    { label: 'Approve', prompt: 'Approve the proposed decision.' },
    { label: 'Commit', prompt: 'Commit the approved decision.' },
  ],
}));

app.get('/api/live-view', async (req, res) => {
  try {
    const segmentId = typeof req.query.segment_id === 'string' ? req.query.segment_id : null;
    res.json(await getLiveView(pool, segmentId, segmentId ? 1 : 40));
  } catch (error) { sendError(res, error); }
});

app.post('/api/decisions', async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    if (!body.segment_id || !body.action_type || !body.drafted_note) throw new Error('Missing decision fields');
    const row = await createProposedDecision(pool, {
      assistRunId: String(body.assist_run_id || randomUUID()), segmentId: String(body.segment_id),
      experimentId: body.experiment_id ? String(body.experiment_id) : null,
      actionType: String(body.action_type), flagKey: String(body.flag_key || 'checkout_flow'),
      variant: String(body.variant || 'variant_a'),
      rolloutPct: typeof body.rollout_pct === 'number' ? body.rollout_pct : null,
      draftedNote: String(body.drafted_note),
      predictedConversionLift: typeof body.predicted_conversion_lift === 'number' ? body.predicted_conversion_lift : null,
    });
    res.status(201).json(row);
  } catch (error) { sendError(res, error); }
});

app.post('/api/decisions/:id/approve', async (req, res) => {
  try { res.json(await transitionDecision(pool, req.params.id, 'approved', actor(req))); }
  catch (error) { sendError(res, error); }
});

app.post('/api/decisions/:id/commit', async (req, res) => {
  try {
    const decision = await transitionDecision(pool, req.params.id, 'committed', actor(req));
    const state = await getLiveView(pool, String(decision.segment_id), 1);
    res.json({ decision, state_refreshed_at: state.queried_at, live_view: state.rows[0] });
  } catch (error) { sendError(res, error); }
});

app.post('/api/assist', async (req, res) => {
  const assistRunId = randomUUID();
  const segmentId = String(req.body?.segment_id || HERO_SEGMENT_ID);
  try {
    const live = await getLiveView(pool, segmentId, 1);
    const hero = live.rows[0];
    if (!hero) throw new Error(`Segment not found: ${segmentId}`);
    const ranking = parseActionRanking(hero.action_ranking);
    const search = await pool.query(
      'SELECT * FROM app.search_experiments($1, $2) ORDER BY relevance DESC NULLS LAST LIMIT $2',
      ['checkout android gen-z', 5],
    );
    const experiment = search.rows.find((row) => row.experiment_id === HERO_EXPERIMENT_ID) || search.rows[0];
    if (!experiment) throw new Error('Experiment search returned no grounding result');

    const prompt = `Draft a concise rollout memo. Stop before approval.\nSegment: ${JSON.stringify(hero)}\nRanked actions: ${JSON.stringify(ranking)}\nExperiment evidence: ${JSON.stringify(experiment)}`;
    const token = req.header('x-forwarded-access-token');
    if (!token) throw new Error('Missing Databricks app OBO token');
    const host = String(process.env.DATABRICKS_HOST || '').replace(/\/$/, '');
    const model = process.env.AI_GATEWAY_MODEL || 'last_penguin_catalog.nimbus.nimbus_app_gateway';
    const { body: gatewayBody } = await requestChatCompletion({
      host, token, model,
      messages: [
        { role: 'system', content: 'You are a growth operations analyst. Draft evidence-based rollout memos. Never approve or commit.' },
        { role: 'user', content: prompt },
      ],
      tags: { application: 'nimbus-growth-desk', assist_run_id: assistRunId, segment_id: segmentId, experiment_id: String(experiment.experiment_id) },
    });
    const memo = gatewayBody.choices?.[0]?.message?.content?.trim();
    if (!memo) throw new Error('AI Gateway returned no memo');
    const proposed = await createProposedDecision(pool, {
      assistRunId, segmentId, experimentId: String(experiment.experiment_id),
      actionType: String(hero.recommended_action), flagKey: String(hero.neighbor_flag_key),
      variant: String(experiment.variant || 'variant_a'), rolloutPct: 25, draftedNote: memo,
      predictedConversionLift: Number(hero.predicted_conversion_lift),
    });
    res.status(201).json({
      executed_at: new Date().toISOString(), assist_run_id: assistRunId, segment_id: segmentId,
      experiment_id: experiment.experiment_id, decision_id: proposed.id,
      investigation: hero, search_results: search.rows, ranked_actions: ranking,
      drafted_memo: memo, decision_status: 'proposed', approval_required: true,
    });
  } catch (error) { sendError(res, error); }
});

app.get('/api/activity/recent', async (_req, res) => {
  try { const result = await pool.query('SELECT * FROM app.feature_decisions_app ORDER BY created_at DESC LIMIT 25'); res.json(result.rows); }
  catch (error) { sendError(res, error); }
});

}

await createApp({
  plugins: [server({ staticPath: 'client/dist' }), lakebase({ pool: { max: 8 } })],
  async onPluginsReady(appkit) {
    const pool = appkit.lakebase.pool as Pool;
    await initializeDecisionSchema(pool);
    appkit.server.extend((app) => registerRoutes(app, pool));
    console.log('[nimbus] live Lakebase runtime initialized');
  },
});
