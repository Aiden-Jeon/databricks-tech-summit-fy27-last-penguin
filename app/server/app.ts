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

app.post('/api/chat/stream', (req, res) => {
  const conversation = conversations.get(req.body?.conversationId);
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
  const prompt = String(req.body?.messages?.at(-1)?.content ?? '');
  const timestamp = now();
  conversation.messages.push({ id: randomUUID(), role: 'user', content: prompt, createdAt: timestamp });
  const answer = 'Nimbus 앱이 정상 실행 중입니다. 데이터 분석과 추천 기능은 Lakebase, SQL Warehouse, Genie 리소스를 연결하면 활성화됩니다.';
  conversation.messages.push({ id: randomUUID(), role: 'assistant', content: answer, createdAt: now() });
  conversation.updatedAt = now();
  if (conversation.title === 'New conversation' && prompt) conversation.title = prompt.slice(0, 48);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.write(`data: ${JSON.stringify({ type: 'response.output_text.delta', delta: answer })}\n\n`);
  res.write(`data: ${JSON.stringify({ type: 'response.completed' })}\n\n`);
  res.end();
});

app.use('/api', (_req, res) => res.status(503).json({ error: 'This feature requires a Databricks data resource binding.' }));

const currentDir = dirname(fileURLToPath(import.meta.url));
const clientDir = resolve(currentDir, '../client/dist');
if (!existsSync(clientDir)) throw new Error(`Client build not found: ${clientDir}`);
app.use(express.static(clientDir));
app.get('*', (_req, res) => res.sendFile(resolve(clientDir, 'index.html')));

const port = Number(process.env.DATABRICKS_APP_PORT ?? process.env.PORT ?? 8000);
app.listen(port, '0.0.0.0', () => console.log(`[nimbus] listening on 0.0.0.0:${port}`));
