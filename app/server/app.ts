import express from 'express';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { createApp, lakebase, server } from '@databricks/appkit';
import {
  HERO_SEGMENT_ID,
  buildKoreanEvidencePrompt,
  completeInvestigation,
  createInvestigationCase,
  createProposedDecision,
  failInvestigation,
  getCase,
  getCases,
  getDecision,
  getLiveView,
  getSearchExperiments,
  initializeDecisionSchema,
  parseActionRanking,
  redraftProposedDecision,
  resetDemoDecision,
  transitionDecision,
  validateRolloutPct,
} from './nimbus-runtime.js';
import { GatewayHttpError, GatewayPolicyDeniedError, requestChatCompletion } from './lib/ai-gateway.js';
import { authHeaders } from './lib/auth.js';

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
  const status = /not found/i.test(message) ? 404 : /Invalid|required|Missing|No unprocessed/i.test(message) ? 409 : 500;
  res.status(status).json({ error: message });
}

async function runInvestigation(pool: Pool, req: express.Request, decisionId: string) {
  const assistRunId = randomUUID();
  const decision = await getDecision(pool, decisionId);
  const decisionRow = decision.rows[0];
  const segmentId = String(decisionRow.segment_id);
  const live = await getLiveView(pool, segmentId, 1);
  const metric = live.rows[0] as Record<string, unknown> | undefined;
  if (!metric) throw new Error(`Segment not found: ${segmentId}`);
  const ranking = parseActionRanking(metric.action_ranking);
  const searchTerms = [metric.cohort, metric.platform, metric.region].filter(Boolean).join(' ');
  const search = await getSearchExperiments(pool, searchTerms || segmentId, 5);
  const experiment = search.rows[0] as Record<string, unknown> | undefined;
  if (!experiment) throw new Error('Experiment search returned no grounding result');
  const prompt = buildKoreanEvidencePrompt(metric, ranking[0] ?? {}, experiment);
  const headers = await authHeaders(req);
  const authorization = headers.get('authorization');
  if (!authorization?.toLowerCase().startsWith('bearer ')) {
    throw new Error('Databricks authentication did not provide a bearer token');
  }
  const token = authorization.slice('bearer '.length);
  const { body } = await requestChatCompletion({
    host: String(process.env.DATABRICKS_HOST || '').replace(/\/$/, ''), token,
    model: process.env.AI_GATEWAY_MODEL || 'last_penguin_catalog.nimbus.nimbus_app_gateway',
    messages: [
      { role: 'system', content: '당신은 근거 기반 그로스 분석가입니다. 한국어 Markdown으로 작성하고 사람의 승인을 대신하지 마세요.' },
      { role: 'user', content: prompt },
    ],
    tags: { application: 'nimbus-growth-desk', assist_run_id: assistRunId, segment_id: segmentId, experiment_id: String(experiment.experiment_id ?? '') },
  });
  const memo = body.choices?.[0]?.message?.content?.trim();
  if (!memo) throw new Error('AI Gateway returned no memo');
  const proposed = await completeInvestigation(pool, decisionId, {
    assistRunId, experimentId: experiment.experiment_id ? String(experiment.experiment_id) : null,
    actionType: String(metric.recommended_action), flagKey: String(metric.neighbor_flag_key ?? ''),
    variant: String(experiment.variant ?? 'variant_a'), draftedNote: memo,
    predictedConversionLift: Number(metric.predicted_conversion_lift),
  });
  return { executed_at: new Date().toISOString(), decision_id: proposed.id, segment_id: segmentId };
}

async function generateKoreanMemo(
  req: express.Request,
  metric: Record<string, unknown>,
  recommendation: Record<string, unknown>,
  experiment: Record<string, unknown>,
  assistRunId: string,
) {
  const headers = await authHeaders(req);
  const authorization = headers.get('authorization');
  if (!authorization?.toLowerCase().startsWith('bearer ')) {
    throw new Error('Databricks authentication did not provide a bearer token');
  }
  const { body } = await requestChatCompletion({
    host: String(process.env.DATABRICKS_HOST || '').replace(/\/$/, ''),
    token: authorization.slice('bearer '.length),
    model: process.env.AI_GATEWAY_MODEL || 'last_penguin_catalog.nimbus.nimbus_app_gateway',
    messages: [
      {
        role: 'system',
        content: '당신은 근거 기반 그로스 분석가입니다. 지정된 한국어 Markdown 구조를 지키고 사람의 승인을 대신하지 마세요.',
      },
      { role: 'user', content: buildKoreanEvidencePrompt(metric, recommendation, experiment) },
    ],
    tags: {
      application: 'nimbus-growth-desk', assist_run_id: assistRunId,
      segment_id: String(metric.segment_id ?? ''), experiment_id: String(experiment.experiment_id ?? ''),
    },
  });
  const memo = body.choices?.[0]?.message?.content?.trim();
  if (!memo) throw new Error('AI Gateway returned no memo');
  return memo;
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
  mlflowExperimentId: null, agentMlflowExperimentId: null,
  dashboardId: '01f1a1dd34c41076a3e8815da30f2fd4',
  gatewayDashboardUrl: `${String(process.env.DATABRICKS_HOST || '').replace(/\/$/, '')}/dashboardsv3/01f1a1dd34c41076a3e8815da30f2fd4/published?isDbOne=true&utm_source=nimbus-growth-desk`,
  demoBudget: { alertUsd: 0.03, hardStopUsd: 0.05 },
  branding: { appName: 'Nimbus Growth Desk' },
  assistantScript: [
    { label: 'Investigate + draft', prompt: `Why is ${HERO_SEGMENT_ID} sliding and what should ship?` },
    { label: 'Approve', prompt: 'Approve the proposed decision.' },
    { label: 'Commit', prompt: 'Commit the approved decision.' },
  ],
}));

app.post('/api/demo/reset', async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const keys = Object.keys(body).sort();
    if (keys.length !== 2 || keys[0] !== 'confirm' || keys[1] !== 'segment_id' ||
        body.segment_id !== HERO_SEGMENT_ID || body.confirm !== true) {
      res.status(400).json({
        error: `Reset requires exactly {segment_id:"${HERO_SEGMENT_ID}", confirm:true}`,
      });
      return;
    }
    res.json(await resetDemoDecision(pool, HERO_SEGMENT_ID));
  } catch (error) { sendError(res, error); }
});

app.get('/api/live-view', async (req, res) => {
  try {
    const segmentId = typeof req.query.segment_id === 'string' ? req.query.segment_id : null;
    res.json(await getLiveView(pool, segmentId, segmentId ? 1 : 40));
  } catch (error) { sendError(res, error); }
});

app.get('/api/cases', async (_req, res) => {
  try { res.json(await getCases(pool)); } catch (error) { sendError(res, error); }
});

app.get('/api/cases/:id', async (req, res) => {
  try { res.json(await getCase(pool, req.params.id)); } catch (error) { sendError(res, error); }
});

app.post('/api/investigations/next', async (_req, res) => {
  try {
    const created = await createInvestigationCase(pool);
    res.status(201).json({ decision_id: created.id, segment_id: created.segment_id, status: created.status });
  } catch (error) { sendError(res, error); }
});

app.post('/api/investigations/:id/run', async (req, res) => {
  const lockClient = await pool.connect();
  let locked = false;
  try {
    const lock = await lockClient.query('SELECT pg_try_advisory_lock(hashtext($1)) AS locked', [`investigation:${req.params.id}`]);
    locked = lock.rows[0]?.locked === true;
    if (!locked) { res.status(409).json({ error: '이미 조사가 실행 중입니다.' }); return; }
    const decision = await getDecision(pool, req.params.id);
    const status = String(decision.rows[0].status);
    if (!['investigating', 'investigation_failed'].includes(status)) throw new Error(`Invalid investigation state: ${status}`);
    if (status === 'investigation_failed') {
      await pool.query("UPDATE app.feature_decisions_app SET status='investigating' WHERE id=$1 AND status='investigation_failed'", [req.params.id]);
    }
    res.json(await runInvestigation(pool, req, req.params.id));
  } catch (error) {
    await failInvestigation(pool, req.params.id, error);
    sendError(res, error);
  } finally {
    if (locked) await lockClient.query('SELECT pg_advisory_unlock(hashtext($1))', [`investigation:${req.params.id}`]);
    lockClient.release();
  }
});

app.get('/api/search-experiments', async (req, res) => {
  try {
    const query = typeof req.query.q === 'string' && req.query.q.trim()
      ? req.query.q.trim()
      : 'checkout android gen-z';
    const requestedLimit = Number(req.query.limit ?? 5);
    const limit = Number.isFinite(requestedLimit) ? requestedLimit : 5;
    res.json(await getSearchExperiments(pool, query, limit));
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

app.get('/api/decisions/:id', async (req, res) => {
  try { res.json(await getDecision(pool, req.params.id)); }
  catch (error) { sendError(res, error); }
});

app.post('/api/decisions/:id/redraft', async (req, res) => {
  try {
    const detail = await getCase(pool, req.params.id);
    const row = detail.case as Record<string, unknown>;
    if (row.status !== 'proposed') throw new Error(`Invalid redraft state: ${String(row.status)}`);
    const experiment = row.experiment as Record<string, unknown> | null;
    if (!experiment) throw new Error('Experiment evidence is required to redraft the memo');
    const ranking = parseActionRanking(row.action_ranking);
    const assistRunId = randomUUID();
    const memo = await generateKoreanMemo(req, row, ranking[0] ?? {}, experiment, assistRunId);
    const decision = await redraftProposedDecision(pool, req.params.id, memo, assistRunId);
    res.json({ decision, drafted_note: memo, redrafted_at: new Date().toISOString() });
  } catch (error) { sendError(res, error); }
});

app.post('/api/decisions/:id/approve', async (req, res) => {
  try {
    const rolloutPct = validateRolloutPct(req.body?.rollout_pct);
    res.json(await transitionDecision(pool, req.params.id, 'approved', actor(req), rolloutPct));
  }
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
  try {
    const created = await createInvestigationCase(pool);
    res.status(201).json(await runInvestigation(pool, req, String(created.id)));
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
