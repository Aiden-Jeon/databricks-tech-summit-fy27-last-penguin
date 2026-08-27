import { expect, test, type Locator, type Page } from '@playwright/test';

type DecisionStatus = 'idle' | 'proposed' | 'approved' | 'committed';

const config = {
  mlflowExperimentId: null,
  agentMlflowExperimentId: null,
  dashboardId: 'dashboard-id',
  gatewayDashboardUrl: 'https://example.com/gateway',
  demoBudget: { alertUsd: 0.03, hardStopUsd: 0.05 },
  branding: { appName: 'Nimbus Growth Desk' },
  assistantScript: [],
};

async function mockApp(page: Page, initialStatus: DecisionStatus) {
  let status = initialStatus;
  let resetBody: unknown;

  await page.route('**/api/me', (route) => route.fulfill({
    json: {
      userName: 'tester',
      userEmail: 'tester@example.com',
      workspaceUrl: 'https://example.com',
      workspaceId: 'workspace-id',
      isUserContext: true,
    },
  }));
  await page.route('**/api/config', (route) => route.fulfill({ json: config }));
  await page.route('**/api/live-view?**', (route) => route.fulfill({
    json: {
      queried_at: '2026-08-27T12:00:00.000Z',
      rows: [{
        segment_id: 'SEG-0000214',
        conversion_rate: 0.029,
        conversion_rate_3w_ago: 0.042,
        mau: 420000,
        conversion_at_risk_usd: 524200,
        recommended_action: 'ship_proven_variant',
        predicted_conversion_lift: 0.018,
        predicted_net_value_usd: 721300,
        decision_id: status === 'idle' ? undefined : 'decision-1',
        decision_status: status,
      }],
    },
  }));
  await page.route('**/api/demo/reset', async (route) => {
    resetBody = route.request().postDataJSON();
    status = 'idle';
    await route.fulfill({
      json: {
        segment_id: 'SEG-0000214',
        deleted_count: 1,
        synchronized_sources_changed: false,
      },
    });
  });

  return { getResetBody: () => resetBody };
}

function channel(value: number) {
  const normalized = value / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(rgb: number[]) {
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
}

function contrast(first: number[], second: number[]) {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

async function renderedColors(locator: Locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas context unavailable');
    const toRgb = (color: string) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return Array.from(context.getImageData(0, 0, 1, 1).data.slice(0, 3));
    };
    return {
      foreground: toRgb(style.color),
      background: toRgb(style.backgroundColor),
      opacity: style.opacity,
    };
  });
}

test('initial workflow action is enabled, keyboard-focusable, and readable', async ({ page }) => {
  await mockApp(page, 'idle');
  await page.goto('/');

  const action = page.getByRole('button', { name: '근거 검색 + 초안' });
  await expect(action).toBeVisible();
  await expect(action).toBeEnabled();
  await action.focus();
  await expect(action).toBeFocused();

  const colors = await renderedColors(action);
  expect(contrast(colors.foreground, colors.background)).toBeGreaterThanOrEqual(4.5);
});

test('committed workflow shows completed states and resets through confirmation', async ({ page }) => {
  const app = await mockApp(page, 'committed');
  await page.goto('/');

  await expect(page.getByText('초안 생성 완료', { exact: true })).toBeVisible();
  await expect(page.getByText('승인 완료', { exact: true })).toBeVisible();
  await expect(page.getByText('결정 기록 완료', { exact: true })).toBeVisible();
  await expect(page.getByText('승인 결정 기록 완료', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: '결정 기록' })).toBeVisible();
  await expect(page.getByText(/Lakebase에 하나의 ID로 저장합니다/)).toBeVisible();

  const completedStates = page.getByRole('status');
  await expect(completedStates).toHaveCount(3);
  for (let index = 0; index < 3; index += 1) {
    const colors = await renderedColors(completedStates.nth(index));
    expect(colors.opacity).toBe('1');
    expect(contrast(colors.foreground, colors.background)).toBeGreaterThanOrEqual(4.5);
  }
  await expect(page.getByRole('button', { name: '초안 생성 완료' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '승인 완료' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '결정 기록 완료' })).toHaveCount(0);

  await page.getByRole('button', { name: '새 조사 시작' }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await expect(page.getByText(/앱 작성 의사결정 행만 삭제합니다/)).toBeVisible();
  await page.getByRole('button', { name: '확인하고 초기화' }).click();

  await expect(page.getByRole('button', { name: '근거 검색 + 초안' })).toBeEnabled();
  expect(app.getResetBody()).toEqual({ segment_id: 'SEG-0000214', confirm: true });
});

for (const width of [320, 1440]) {
  test(`workflow fits a ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockApp(page, 'committed');
    await page.goto('/');

    const sizes = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(sizes.content).toBeLessThanOrEqual(sizes.viewport);
    await expect(page.getByRole('button', { name: '새 조사 시작' })).toBeVisible();
  });
}
