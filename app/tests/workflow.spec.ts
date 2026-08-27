import { expect, test, type Page } from '@playwright/test';

type Status = 'investigating' | 'investigation_failed' | 'proposed' | 'approved' | 'committed';
const segment = 'SEG-0098765';

async function mockApp(page: Page, initial: Status = 'proposed', draftedNote = '## 근거\n\n- 검증된 실험 결과입니다.') {
  let status = initial;
  let rollout = 100;
  const calls: Array<{ url: string; body?: unknown }> = [];
  const base = {
    id: 'decision-7', decision_id: 'decision-7', segment_id: segment,
    conversion_rate_3w_ago: .04, conversion_rate: .03, predicted_conversion_lift: .02,
    conversion_at_risk_usd: 500000, predicted_net_value_usd: 700000,
    recommended_action: 'ship_proven_variant', scored_at: '2026-08-27T10:00:00Z',
    decision_created_at: '2026-08-27T10:00:00Z', drafted_note: draftedNote,
    target_experiment_id: 'EXP-DYNAMIC', experiment: { experiment_id: 'EXP-DYNAMIC', description: '유사 코호트 실험' },
  };
  await page.route('**/api/me', (route) => route.fulfill({ json: { userName: 'tester', userEmail: 'tester@example.com' } }));
  await page.route('**/api/config', (route) => route.fulfill({ json: { gatewayDashboardUrl: 'https://example.com/cost' } }));
  await page.route('**/api/cases', (route) => route.fulfill({ json: { queried_at: '2026-08-27T12:00:00Z', cases: [{ ...base, decision_status: status, rollout_pct: rollout }] } }));
  await page.route('**/api/cases/decision-7', (route) => route.fulfill({ json: { case: { ...base, status, rollout_pct: rollout, approved_by: status === 'proposed' ? null : 'tester@example.com', decided_at: status === 'committed' ? '2026-08-27T12:00:00Z' : null, audit_trail: status === 'committed' ? [{ action: 'proposed', by: 'AI', at: '2026-08-27T10:00:00Z' }, { action: 'approved', by: 'tester@example.com', at: '2026-08-27T11:00:00Z' }, { action: 'committed', by: 'tester@example.com', at: '2026-08-27T12:00:00Z' }] : [] } } }));
  await page.route('**/api/decisions/decision-7/approve', async (route) => { const body = route.request().postDataJSON(); rollout = body.rollout_pct; status = 'approved'; calls.push({ url: route.request().url(), body }); await route.fulfill({ json: { ...base, status, rollout_pct: rollout } }); });
  await page.route('**/api/decisions/decision-7/commit', async (route) => { status = 'committed'; calls.push({ url: route.request().url() }); await route.fulfill({ json: { decision: { ...base, status } } }); });
  await page.route('**/api/decisions/decision-7/redraft', async (route) => {
    base.drafted_note = '## 한줄 결론\n\n검증된 변형 출시가 가장 유력합니다.\n\n## 판단 근거\n\n- 유사 실험에서 상승 효과가 확인됐습니다.\n\n## 기대 효과\n\n- 전환율 회복이 예상됩니다.\n\n## 실행 전 확인사항\n\n- 충돌 실험을 확인하세요.';
    calls.push({ url: route.request().url() });
    await route.fulfill({ json: { decision: { ...base }, drafted_note: base.drafted_note } });
  });
  return calls;
}

test('cases render in the inbox and rollout recalculates the linear forecast', async ({ page }) => {
  await mockApp(page); await page.goto('/');
  await expect(page.getByRole('button', { name: new RegExp(segment) })).toBeVisible();
  await page.getByRole('button', { name: '25%' }).click();
  await expect(page.getByRole('cell', { name: '4.0%' })).toBeVisible();
  await expect(page.getByRole('cell', { name: '3.5%' })).toBeVisible();
  await expect(page.getByText('+0.50%p')).toBeVisible();
  await expect(page.getByText('단순 선형 추정', { exact: true })).toBeVisible();
});

test('approver changes only rollout and can commit after approval', async ({ page }) => {
  const calls = await mockApp(page); await page.goto('/');
  await page.getByRole('button', { name: '50%' }).click();
  await page.getByRole('button', { name: '이 비율로 승인' }).click();
  expect(calls[0].body).toEqual({ rollout_pct: 50 });
  await expect(page.getByRole('button', { name: '결정 기록' })).toBeVisible();
  await page.getByRole('button', { name: '결정 기록' }).click();
  await expect(page.getByRole('heading', { name: '결정 및 감사 이력' })).toBeVisible();
  await expect(page.getByText('tester@example.com').last()).toBeVisible();
});

for (const status of ['proposed', 'approved'] as const) test(`${status} highlights only its current workflow step`, async ({ page }) => {
  await mockApp(page, status); await page.goto('/');
  await expect(page.getByTestId(`case-step-${status}`)).toHaveClass(/is-current/);
  await expect(page.locator('.case-steps .is-current')).toHaveCount(1);
});

for (const width of [320, 1440]) test(`committed workflow is fully muted at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); await mockApp(page, 'committed'); await page.goto('/');
  const steps = page.locator('.case-steps > li');
  await expect(steps).toHaveCount(3);
  await expect(page.locator('.case-steps .is-current')).toHaveCount(0);
  for (let index = 0; index < 3; index += 1) {
    await expect(steps.nth(index)).toHaveClass(/is-complete/);
    await expect(steps.nth(index).locator('svg')).toHaveCount(1);
  }
});

test('AI evidence is expanded by default and contains no hard-coded rollout copy', async ({ page }) => {
  await mockApp(page); await page.goto('/');
  const summary = page.getByText('AI 근거 요약');
  await expect(summary).toBeVisible();
  await expect(page.getByTestId('ai-evidence')).toHaveAttribute('open', '');
  await expect(page.getByText('검증된 실험 결과입니다.')).toBeVisible();
  const highlights = page.getByLabel('AI 근거 핵심 요약');
  await expect(highlights.getByText('추천 액션', { exact: true })).toBeVisible();
  await expect(highlights.getByText('연결 실험', { exact: true })).toBeVisible();
  await expect(page.getByText('AI 생성 · 검토 필요')).toBeVisible();
  await expect(page.locator('.ai-markdown')).not.toContainText('롤아웃');
});

test('decision content follows experiment, report, AI summary, action order', async ({ page }) => {
  await mockApp(page); await page.goto('/');
  await expect(page.getByTestId('recovery-scenario')).toBeVisible();
  const order = await page.locator('[data-testid="recovery-scenario"], [data-testid="evidence-section"], [data-testid="ai-evidence"], [data-testid="recommended-action"]').evaluateAll((elements) => elements.map((element) => element.getAttribute('data-testid')));
  expect(order).toEqual(['evidence-section', 'recovery-scenario', 'ai-evidence', 'recommended-action']);
  await expect(page.getByText(/출처: Lakebase 라이브 뷰/)).toHaveCount(0);
  await expect(page.getByTestId('ai-evidence')).toHaveClass(/ai-evidence/);
  await expect(page.getByTestId('recommended-action')).toHaveClass(/approval-card--pending/);

  await page.getByRole('button', { name: '이 비율로 승인' }).click();
  await expect(page.getByTestId('recommended-action')).toHaveClass(/approval-card--approved/);
});

test('legacy English proposed memo can be redrafted in Korean', async ({ page }) => {
  const calls = await mockApp(page, 'proposed', '## Evidence\n\nA winning experiment supports this action.');
  await page.goto('/');
  await expect(page.getByText('이 메모는 이전 형식의 영어 초안입니다.')).toBeVisible();
  await page.getByRole('button', { name: '한국어로 다시 작성' }).click();
  await expect(page.getByRole('heading', { name: '한줄 결론' })).toBeVisible();
  await expect(page.getByText('검증된 변형 출시가 가장 유력합니다.')).toBeVisible();
  await expect(page.getByRole('button', { name: '한국어로 다시 작성' })).toHaveCount(0);
  expect(calls.some((call) => call.url.endsWith('/redraft'))).toBe(true);
});

test('approved legacy memo remains immutable', async ({ page }) => {
  await mockApp(page, 'approved', '## Evidence\n\nOriginal audit memo.');
  await page.goto('/');
  await expect(page.getByText('Original audit memo.')).toBeVisible();
  await expect(page.getByRole('button', { name: '한국어로 다시 작성' })).toHaveCount(0);
});

for (const width of [320, 1440]) test(`${width}px viewport has no horizontal overflow`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); await mockApp(page, 'approved'); await page.goto('/');
  if (width === 320) await page.getByRole('button', { name: /업무함/ }).click();
  await expect(page.getByRole('button', { name: new RegExp(segment) })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  const evidence = page.getByTestId('ai-evidence');
  await expect(evidence).toHaveAttribute('open', '');
  await evidence.getByText('AI 근거 요약').click();
  await expect(evidence).not.toHaveAttribute('open', '');
  await evidence.getByText('AI 근거 요약').click();
  await expect(evidence).toHaveAttribute('open', '');
  for (const label of ['25%', '50%', '100%']) {
    const box = await page.getByRole('button', { name: label, exact: true }).boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
  const actionBox = await page.getByRole('button', { name: '결정 기록' }).boundingBox();
  expect(actionBox?.height).toBeGreaterThanOrEqual(48);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
});

test('new investigation appears immediately, keeps its id, and hides approval until complete', async ({ page }) => {
  let status: Status = 'proposed';
  let releaseRun!: () => void;
  const runGate = new Promise<void>((resolve) => { releaseRun = resolve; });
  await page.route('**/api/me', (route) => route.fulfill({ json: { userEmail: 'tester@example.com' } }));
  await page.route('**/api/config', (route) => route.fulfill({ json: {} }));
  await page.route('**/api/investigations/next', async (route) => { status = 'investigating'; await route.fulfill({ status: 201, json: { decision_id: 'case-new', segment_id: 'SEG-NEW', status } }); });
  await page.route('**/api/investigations/case-new/run', async (route) => { await runGate; status = 'proposed'; await route.fulfill({ json: { id: 'case-new', status } }); });
  const row = () => ({ id: 'case-new', decision_id: 'case-new', segment_id: 'SEG-NEW', status, decision_status: status, conversion_rate: .03, conversion_rate_3w_ago: .04, predicted_conversion_lift: .01 });
  await page.route('**/api/cases', (route) => route.fulfill({ json: { queried_at: new Date().toISOString(), cases: status === 'proposed' ? [] : [row()] } }));
  await page.route('**/api/cases/case-new', (route) => route.fulfill({ json: { case: row() } }));
  await page.goto('/');
  await page.getByRole('button', { name: '새 조사' }).click();
  await expect(page.getByRole('button', { name: /SEG-NEW.*진행 중/ })).toBeVisible();
  await expect(page.getByText('실험 근거와 AI 요약을 생성하고 있습니다').last()).toBeVisible();
  await expect(page.getByRole('button', { name: '이 비율로 승인' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '조사 중…' })).toBeDisabled();
  releaseRun();
  await expect(page.getByText('승인 대기').last()).toBeVisible();
  await expect(page.getByRole('button', { name: '이 비율로 승인' })).toBeVisible();
});

test('failed investigation stays in the inbox and can be retried', async ({ page }) => {
  let status: Status = 'investigation_failed';
  let attempts = 0;
  const row = () => ({
    id: 'case-failed', decision_id: 'case-failed', segment_id: 'SEG-FAILED', status, decision_status: status,
    conversion_rate: .03, conversion_rate_3w_ago: .04, predicted_conversion_lift: .01,
    audit_trail: status === 'investigation_failed' ? [{ action: 'investigation_failed', notes: 'AI Gateway 인증 실패' }] : [],
  });
  await page.route('**/api/me', (route) => route.fulfill({ json: { userEmail: 'tester@example.com' } }));
  await page.route('**/api/config', (route) => route.fulfill({ json: {} }));
  await page.route('**/api/cases', (route) => route.fulfill({ json: { queried_at: new Date().toISOString(), cases: [row()] } }));
  await page.route('**/api/cases/case-failed', (route) => route.fulfill({ json: { case: row() } }));
  await page.route('**/api/investigations/case-failed/run', async (route) => {
    attempts += 1; status = 'proposed'; await route.fulfill({ json: { id: 'case-failed', status } });
  });
  await page.goto('/');
  await expect(page.getByText('조사 실패').last()).toBeVisible();
  await expect(page.getByText('AI Gateway 인증 실패')).toBeVisible();
  await expect(page.getByRole('button', { name: '이 비율로 승인' })).toHaveCount(0);
  await page.getByRole('button', { name: '다시 조사' }).click();
  await expect(page.getByText('승인 대기').last()).toBeVisible();
  await expect(page.getByRole('button', { name: '이 비율로 승인' })).toBeVisible();
  expect(attempts).toBe(1);
});
