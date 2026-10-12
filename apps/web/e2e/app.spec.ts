import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const uid = () => Math.random().toString(36).slice(2, 8);

async function register(page: Page) {
  await page.goto('/register');
  await page.getByLabel('Display name').fill('E2E Student');
  await page.getByLabel('Email').fill(`e2e-${uid()}@example.test`);
  await page.getByLabel('Password').fill('a long enough password');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/onboarding/);
}

test('register, onboard and solve with verification', async ({ page }) => {
  await register(page);
  await page.getByRole('button', { name: 'Physics' }).click();
  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(page.getByRole('heading', { name: /Hello, E2E Student/ })).toBeVisible();
  await page.goto('/solver');
  await page.getByPlaceholder(/Type or paste a question/).fill('x^2 - 5x + 6 = 0');
  await page.keyboard.press('Control+Enter');
  await expect(page.getByText('Verified by an independent check')).toBeVisible();
  await expect(page.getByText('Solved by: deterministic')).toBeVisible();
  await expect(page.locator('.katex').first()).toBeVisible();
});

test('switches to Arabic with a right-to-left layout', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('App language').selectOption('ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('link', { name: 'ألعاب بدون إنترنت' }).first()).toBeVisible();
});

test('uploads a document and answers with a page citation', async ({ page }) => {
  await register(page);
  await page.goto('/documents');
  await page.locator('input[type=file]').setInputFiles({ name: 'bio.txt', mimeType: 'text/plain', buffer: Buffer.from('Photosynthesis takes place in the chloroplasts of plant cells.\nMitochondria produce ATP.') });
  await expect(page.getByText('Ready')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('link', { name: 'bio' }).click();
  await page.getByPlaceholder(/Ask a question/).fill('Where does photosynthesis take place?');
  await page.getByRole('button', { name: 'Ask about this document' }).last().click();
  await expect(page.getByText(/chloroplasts/).first()).toBeVisible();
  await expect(page.getByText('Source: page 1')).toBeVisible();
});

test('solver works offline with the on-device engine', async ({ page, context }) => {
  await page.goto('/solver');
  await expect(page.getByPlaceholder(/Type or paste a question/)).toBeVisible();
  await context.setOffline(true);
  await page.getByPlaceholder(/Type or paste a question/).fill('Solve 2x + 3 = 11');
  await page.getByRole('button', { name: 'Solve', exact: true }).click();
  await expect(page.getByText('Solved by: on-device')).toBeVisible();
  await expect(page.locator('.katex').first()).toContainText('4');
  await context.setOffline(false);
});

test('plays Math Rush offline, scores, unlocks a level and persists progress', async ({ page, context }) => {
  await page.clock.install();
  await page.goto('/games/math-rush');
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  for (let i = 0; i < 12; i++) {
    const expr = (await page.locator('pre.code-block').innerText()).replace('= ?', '').replace(/×/g, '*').replace(/−/g, '-');
    const answer = Function(`return (${expr})`)() as number;
    await page.getByLabel('Type your answer').fill(String(answer));
    await page.keyboard.press('Enter');
    await page.clock.runFor(300);
  }
  await page.clock.runFor(61_000);
  await expect(page.getByRole('dialog')).toContainText('Level complete!');
  await expect(page.getByRole('dialog')).toContainText('Level 2 unlocked');
  await page.getByRole('button', { name: 'Close' }).click();
  await context.setOffline(false);
  await page.goto('/games');
  const card = page.getByRole('link', { name: 'Math Rush' });
  await expect(card).toContainText('Level 2/8');
});

test('main pages have no serious accessibility violations', async ({ page }) => {
  for (const [path, scheme] of [['/', 'light'], ['/games', 'light'], ['/games', 'dark'], ['/solver', 'dark'], ['/tools', 'light'], ['/login', 'dark']] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const serious = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(serious.map((v) => `${path} (${scheme}): ${v.id} (${v.nodes.length})`)).toEqual([]);
  }
});
