import express from 'express';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
};

type Conversation = {
  id: string;
  title: string;
  kind: 'default' | 'demo_dock';
  createdAt: string;
  updatedAt: string;
  messages: Message[];
};

const app = express();
app.use(express.json({ limit: '1mb' }));

const now = () => new Date().toISOString();
const conversations = new Map<string, Conversation>();

function createConversation(title = 'New conversation', kind: Conversation['kind'] = 'default') {
  const timestamp = now();
  const conversation: Conversation = {
    id: randomUUID(),
    title,
    kind,
    createdAt: timestamp,
    updatedAt: timestamp,
    messages: [],
  };
  conversations.set(conversation.id, conversation);
  return conversation;
}

function summary(conversation: Conversation) {
  const { messages: _messages, ...row } = conversation;
  return row;
}

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/api/me', (_req, res) => {
  const host = process.env.DATABRICKS_HOST ?? '';
  res.json({
    userName: process.env.DATABRICKS_USER_NAME ?? 'Nimbus developer',
    userEmail: process.env.DATABRICKS_USER_NAME ?? null,
    workspaceUrl: host.startsWith('http') ? host : host ? `https://${host}` : '',
    workspaceId: process.env.DATABRICKS_WORKSPACE_ID ?? null,
    isUserContext: false,
  });
});

app.get('/api/config', (_req, res) => res.json({
  mlflowExperimentId: null,
  agentMlflowExperimentId: null,
  dashboardId: '',
  branding: { appName: 'Nimbus Growth Desk' },
  assistantScript: [
    { label: 'Investigate', prompt: 'Why is SEG-0000214 sliding on conversion?' },
    { label: 'Recommend', prompt: 'Rank the best action to ship next.' },
    { label: 'Approve', prompt: 'Approve the proven variant.' },
  ],
}));

app.get('/api/warehouse', (_req, res) => res.json({ id: null, name: 'Not connected', state: 'UNCONFIGURED' }));
app.get('/api/activity/recent', (_req, res) => res.json([]));
app.get('/api/returns', (_req, res) => res.json([]));
app.get('/api/returns/summary', (_req, res) => res.json([]));
app.get('/api/returns/by-city', (_req, res) => res.json([]));
app.get('/api/facilities/summary', (_req, res) => res.json([]));
app.get('/api/resources', (_req, res) => {
  const empty = { id: '', url: '' };
  res.json(Object.fromEntries([
    'dashboard', 'genie', 'pipeline', 'warehouse', 'lakebase', 'mas', 'ka',
    'gateway', 'databricksOne', 'agentBricks', 'catalog', 'model', 'volume', 'app',
  ].map((key) => [key, empty])));
});

app.get('/api/conversations', (_req, res) => {
  res.json([...conversations.values()].map(summary).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
});
app.post('/api/conversations', (req, res) => res.status(201).json(summary(createConversation(req.body?.title))));
app.get('/api/dock-conversation', (_req, res) => {
  const existing = [...conversations.values()].find((item) => item.kind === 'demo_dock');
  res.json(summary(existing ?? createConversation('Nimbus demo', 'demo_dock')));
});
app.get('/api/conversations/:id', (req, res) => {
  const conversation = conversations.get(req.params.id);
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
  return res.json(conversation);
});
app.delete('/api/conversations/:id', (req, res) => {
  conversations.delete(req.params.id);
  res.status(204).end();
});
app.post('/api/admin/reset', (_req, res) => {
  conversations.clear();
  res.status(204).end();
});

const blockedLakebaseRead = /(?:all|entire|every|full)[\s\S]{0,40}(?:lakebase|database|tables?|data)|unlimited[\s-]*(?:reads?|queries)|full[\s-]*database[\s-]*scan/i;

app.post('/api/chat/stream', async (req, res) => {
  const conversation = conversations.get(req.body?.conversationId);
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
  const prompt = String(req.body?.messages?.at(-1)?.content ?? '');
  if (blockedLakebaseRead.test(prompt)) {
    return res.status(400).json({
      error: 'AI Gateway input policy rejected an unbounded Lakebase read request.',
      policy: 'nimbus-bounded-lakebase-reads',
    });
  }

  const forwardedToken = req.header('x-forwarded-access-token');
  if (!forwardedToken) return res.status(401).json({ error: 'Missing Databricks app OBO token.' });
  const hostValue = process.env.DATABRICKS_HOST ?? '';
  const host = hostValue.startsWith('http') ? hostValue : `https://${hostValue}`;
  const model = process.env.AI_GATEWAY_MODEL ?? 'last_penguin_catalog.nimbus.nimbus_app_gateway';
  const segmentMatch = prompt.match(/SEG-\d+/i);
  const segment = segmentMatch?.[0].toUpperCase() ?? 'unknown';
  const gatewayResponse = await fetch(`${host.replace(/\/$/, '')}/ai-gateway/mlflow/v1/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${forwardedToken}`,
      'content-type': 'application/json',
      'user-agent': 'nimbus-growth-desk/3.0',
      'Databricks-Ai-Gateway-Request-Tags': JSON.stringify({
        application: 'nimbus-growth-desk',
        workload: 'interactive-chat',
        environment: 'production',
        segment,
      }),
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'You are the Nimbus Growth Desk assistant. Be concise and never request or scan an entire database.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 160,
      temperature: 0.2,
    }),
  });
  const gatewayBody = await gatewayResponse.text();
  if (!gatewayResponse.ok) {
    console.error(`[nimbus] AI Gateway ${gatewayResponse.status}: ${gatewayBody.slice(0, 500)}`);
    return res.status(gatewayResponse.status).json({
      error: 'Unity AI Gateway rejected the request.',
      status: gatewayResponse.status,
      detail: gatewayBody.slice(0, 1000),
    });
  }
  const completion = JSON.parse(gatewayBody) as { choices?: Array<{ message?: { content?: string } }> };
  const answer = completion.choices?.[0]?.message?.content?.trim();
  if (!answer) return res.status(502).json({ error: 'Unity AI Gateway returned no assistant content.' });
  const timestamp = now();
  conversation.messages.push({ id: randomUUID(), role: 'user', content: prompt, createdAt: timestamp });
  conversation.messages.push({ id: randomUUID(), role: 'assistant', content: answer, createdAt: now() });
  conversation.updatedAt = now();
  if (conversation.title === 'New conversation' && prompt) conversation.title = prompt.slice(0, 48);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.write(`data: ${JSON.stringify({ type: 'response.output_text.delta', delta: answer })}\n\n`);
  res.write(`data: ${JSON.stringify({ type: 'response.completed' })}\n\n`);
  return res.end();
});

app.use('/api', (_req, res) => res.status(503).json({ error: 'This feature requires a Databricks data resource binding.' }));

const currentDir = dirname(fileURLToPath(import.meta.url));
const clientDir = resolve(currentDir, '../client/dist');
if (!existsSync(clientDir)) throw new Error(`Client build not found: ${clientDir}`);
app.use(express.static(clientDir));
app.get('*', (_req, res) => res.sendFile(resolve(clientDir, 'index.html')));

const port = Number(process.env.DATABRICKS_APP_PORT ?? process.env.PORT ?? 8000);
app.listen(port, '0.0.0.0', () => console.log(`[nimbus] listening on 0.0.0.0:${port}`));
