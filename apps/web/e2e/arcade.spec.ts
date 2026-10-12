import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** Opens a game's menu, dismisses the first-time rules, picks options and starts. */
async function startGame(page: Page, id: string, opts: { mode?: string; difficulty?: string; grid?: string } = {}) {
  await page.goto(`/arcade/${id}`);
  const gotIt = page.getByRole('button', { name: 'Got it' });
  await expect(gotIt).toBeVisible();
  await gotIt.click();
  if (opts.mode) await page.getByRole('button', { name: opts.mode, exact: true }).click();
  if (opts.difficulty) await page.getByRole('button', { name: opts.difficulty, exact: true }).click();
  if (opts.grid) await page.getByRole('button', { name: opts.grid, exact: true }).click();
  await page.locator('.arcade-play').click();
}

const overlay = (page: Page) => page.getByRole('dialog', { name: 'Game over' });

test('hub: 15 arcade games next to 15 educational games, search, categories and favorites persist', async ({ page }) => {
  await page.goto('/arcade');
  await expect(page.locator('.arcade-card')).toHaveCount(15);
  await page.getByLabel('Search games').fill('serpent'); // French title, searched from English UI
  await expect(page.locator('.arcade-card')).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Snake' })).toBeVisible();
  await page.getByLabel('Search games').fill('');
  await page.getByRole('tab', { name: 'Strategy' }).click();
  await expect(page.locator('.arcade-card')).toHaveCount(3);
  await page.getByRole('tab', { name: 'All' }).click();
  await page.getByRole('button', { name: 'Add Sudoku to favorites' }).click();
  await page.reload();
  await page.getByRole('tab', { name: /Favorites/ }).click();
  await expect(page.locator('.arcade-card')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Remove Sudoku from favorites' })).toBeVisible();
  await page.goto('/games');
  await expect(page.locator('.game-card')).toHaveCount(15);
});

test('tic-tac-toe: local two-player win and hard AI never loses', async ({ page }) => {
  await startGame(page, 'tic-tac-toe', { mode: '2 players (this device)' });
  for (const [r, c] of [[1, 1], [2, 1], [1, 2], [2, 2], [1, 3]]) await page.getByRole('gridcell', { name: `Row ${r}, column ${c}`, exact: true }).click();
  await expect(overlay(page)).toContainText('Player 1 (X) wins!');
  await page.getByRole('button', { name: 'Quit' }).last().click();
  await page.getByRole('button', { name: 'Vs computer', exact: true }).click();
  await page.getByRole('button', { name: 'Hard', exact: true }).click();
  await page.locator('.arcade-play').click();
  for (let i = 0; i < 6 && !(await overlay(page).isVisible()); i++) {
    await expect(page.locator('.arcade-status')).toContainText('You to play', { timeout: 3000 }).catch(() => undefined);
    if (await overlay(page).isVisible()) break;
    const free = page.locator('.ttt-cell:not([disabled])');
    if ((await free.count()) === 0) break;
    await free.first().click();
    await page.waitForTimeout(450);
  }
  await expect(overlay(page)).toBeVisible();
  await expect(overlay(page)).not.toContainText('You win');
});

test('connect four: vertical win in pass-and-play', async ({ page }) => {
  await startGame(page, 'connect-four', { mode: '2 players (this device)' });
  for (const c of [1, 2, 1, 2, 1, 2, 1]) await page.getByRole('button', { name: `Column ${c}`, exact: true }).click();
  await expect(overlay(page)).toContainText('Player 1 wins!');
  await expect(page.locator('.c4-slot.win')).toHaveCount(4);
});

test('snake: steers with the keyboard, scores live and ends on a wall', async ({ page }) => {
  await startGame(page, 'snake', { difficulty: 'Hard' });
  await page.keyboard.press('ArrowUp');
  await expect(overlay(page)).toBeVisible({ timeout: 15_000 });
  await expect(overlay(page)).toContainText('Game over');
  await expect(page.locator('.arcade-playhead')).toContainText('Best:');
});

test('falling blocks: hard drops stack pieces, score rises, game ends at the top', async ({ page }) => {
  await startGame(page, 'falling-blocks');
  for (let i = 0; i < 40 && !(await overlay(page).isVisible()); i++) { await page.keyboard.press('Space'); await page.waitForTimeout(40); }
  await expect(overlay(page)).toBeVisible();
  const score = Number((await overlay(page).locator('.arcade-big').innerText()).replace(/\D/g, ''));
  expect(score).toBeGreaterThan(0);
});

test('2048: swipes/keys merge tiles and the board is restored after leaving', async ({ page }) => {
  await startGame(page, '2048');
  // The board is restored asynchronously from local storage; wait for it before pressing keys.
  await expect(page.locator('.g2048-board')).toBeVisible();
  for (const k of ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']) await page.keyboard.press(k);
  await expect(page.getByText(/Moves: [1-9]/)).toBeVisible();
  const tiles = async () => (await page.locator('.g2048-tile').allInnerTexts()).join(',');
  const before = await tiles();
  await page.goto('/arcade');
  await page.goto('/arcade/2048');
  await page.locator('.arcade-play').click();
  await expect.poll(tiles).toBe(before);
});

test('rock paper scissors: best-of-five against the computer ends with a result', async ({ page }) => {
  await startGame(page, 'rock-paper-scissors');
  for (let i = 0; i < 30 && !(await overlay(page).isVisible()); i++) { await page.keyboard.press(String((i % 3) + 1)); await page.waitForTimeout(30); }
  await expect(overlay(page)).toBeVisible();
  await expect(overlay(page)).toContainText(/You win!|You lose/);
});

test('memory match: finds every pair, counts moves', async ({ page }) => {
  await startGame(page, 'memory-match', { grid: '3×4' });
  const cards = page.locator('.mm-card');
  await expect(cards).toHaveCount(12);
  const seen = new Map<string, number>();
  const symbolOf = async (i: number) => ((await cards.nth(i).getAttribute('aria-label')) ?? '').split(': ')[1] ?? '';
  for (let i = 0; i < 12; i++) {
    if (await cards.nth(i).isDisabled()) continue;
    await cards.nth(i).click();
    const sym = await symbolOf(i);
    const twin = seen.get(sym);
    if (twin !== undefined && !(await cards.nth(twin).isDisabled())) { await cards.nth(twin).click(); continue; }
    seen.set(sym, i);
    // flip the next unknown card to complete the move
    for (let j = i + 1; j < 12; j++) {
      if (await cards.nth(j).isDisabled() || [...seen.values()].includes(j)) continue;
      await cards.nth(j).click();
      const s2 = await symbolOf(j);
      if (s2 !== sym) {
        const t2 = seen.get(s2);
        seen.set(s2, j);
        if (t2 !== undefined) { await cards.nth(t2).click(); await cards.nth(j).click(); }
      }
      i = j;
      break;
    }
  }
  await expect(overlay(page)).toContainText('You win!');
});

test('minesweeper: first click is safe, flags count down, pause hides the board', async ({ page }) => {
  await startGame(page, 'minesweeper', { difficulty: 'Easy' });
  await page.getByRole('gridcell', { name: 'Row 5, column 5', exact: true }).click();
  await expect(overlay(page)).toBeHidden();
  expect(await page.locator('.mine-cell.open').count()).toBeGreaterThan(1);
  const closed = page.locator('.mine-cell:not(.open)').first();
  await closed.click({ button: 'right' });
  await expect(page.getByText('💣 9')).toBeVisible();
  await page.getByRole('button', { name: /Pause/ }).click();
  await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
  await page.getByRole('dialog', { name: 'Paused' }).getByRole('button', { name: /Resume/ }).click();
  await expect(page.getByRole('dialog', { name: 'Paused' })).toBeHidden();
});

test('sudoku: a wrong entry counts as a mistake, solving the unique solution wins', async ({ page }) => {
  await startGame(page, 'sudoku', { difficulty: 'Easy' });
  await expect(page.locator('.sd-cell')).toHaveCount(81);
  const saved = await page.waitForFunction(() => localStorage.getItem('exammate.arcade.save.v1.sudoku'));
  const state = JSON.parse((await saved.jsonValue()) as string) as { values: number[]; solution: number[] };
  const empties = state.values.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
  const first = empties[0]!;
  await page.locator('.sd-cell').nth(first).click();
  await page.keyboard.press(String((state.solution[first]! % 9) + 1));
  await expect(page.getByText('Mistakes 1/3')).toBeVisible();
  for (const i of empties) { await page.locator('.sd-cell').nth(i).click(); await page.keyboard.press(String(state.solution[i])); }
  await expect(overlay(page)).toContainText('You win!');
});

test('hangman: guessing letters reveals the word and ends the round', async ({ page }) => {
  await startGame(page, 'hangman');
  await expect(page.getByText(/Category:/)).toBeVisible();
  for (const ch of 'eaiotnsrlcdupmhgbfywkvxzjq') {
    if (await overlay(page).isVisible()) break;
    const key = page.locator('.hm-key', { hasText: new RegExp(`^${ch.toUpperCase()}$`) });
    if (await key.isEnabled()) await key.click();
  }
  await expect(overlay(page)).toBeVisible();
});

test('maze escape: a wall-follower reaches the exit through a generated maze', async ({ page }) => {
  await startGame(page, 'maze-escape', { difficulty: 'Easy' });
  const pos = async () => (await page.locator('svg.maze').getAttribute('aria-label')) ?? '';
  const order = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'];
  let heading = 1; // facing right
  for (let step = 0; step < 600 && !(await overlay(page).isVisible()); step++) {
    // right-hand rule: try right, straight, left, back
    for (const turn of [1, 0, 3, 2]) {
      const d = (heading + turn) % 4;
      const before = await pos();
      await page.keyboard.press(order[d]!);
      if ((await pos()) !== before || (await overlay(page).isVisible())) { heading = d; break; }
    }
  }
  await expect(overlay(page)).toContainText('Escaped!');
});

test('reaction test: false starts are caught and five timed rounds give an average', async ({ page }) => {
  await startGame(page, 'reaction-test');
  const pad = page.locator('.reaction-pad');
  await pad.click();
  await expect(pad).toHaveText('Wait for green…');
  await pad.click();
  await expect(pad).toContainText('Too early!');
  await expect(page.getByText('False starts: 1')).toBeVisible();
  for (let r = 0; r < 5; r++) {
    await pad.click();
    await expect(pad).toHaveText('Tap now!', { timeout: 6000 });
    // Taps within 100 ms of the signal are treated as anticipation (a false start); react like a human.
    await page.waitForTimeout(150);
    await pad.click();
  }
  await expect(overlay(page)).toContainText(/Average \d+ ms/);
});

test('simon says: repeats growing sequences, a wrong pad ends the game with the score', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __seq: number[] };
    w.__seq = [];
    new MutationObserver((muts) => {
      const status = document.querySelector('.arcade-status')?.textContent ?? '';
      if (!status.includes('Watch')) return;
      for (const m of muts) {
        const el = m.target as HTMLElement;
        if (m.attributeName === 'class' && el.classList.contains('simon-pad') && el.classList.contains('lit')) w.__seq.push([...el.parentElement!.children].indexOf(el));
      }
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ['class'] });
  });
  await startGame(page, 'simon-says', { difficulty: 'Hard' });
  for (let round = 1; round <= 3; round++) {
    await expect(page.locator('.arcade-status')).toContainText('Your turn', { timeout: 15_000 });
    const seq = await page.evaluate(() => { const w = window as unknown as { __seq: number[] }; const s = w.__seq; w.__seq = []; return s; });
    expect(seq).toHaveLength(round);
    for (const p of seq) await page.getByRole('button', { name: `Pad ${p + 1}`, exact: true }).dispatchEvent('pointerdown');
    // the press flash of the final pad overlaps the "Watch…" status; playback itself starts 600 ms later
    await page.waitForTimeout(150);
    await page.evaluate(() => { (window as unknown as { __seq: number[] }).__seq = []; });
  }
  await expect(page.locator('.arcade-status')).toContainText('Your turn', { timeout: 15_000 });
  const seq = await page.evaluate(() => (window as unknown as { __seq: number[] }).__seq);
  await page.getByRole('button', { name: `Pad ${((seq[0]! + 1) % 6) + 1}`, exact: true }).dispatchEvent('pointerdown');
  await expect(overlay(page)).toContainText('3');
});

test('checkers: legal moves are highlighted and the computer replies', async ({ page }) => {
  await startGame(page, 'checkers', { difficulty: 'Easy' });
  for (let move = 0; move < 4; move++) {
    await expect(page.locator('.arcade-status')).toContainText('You to play', { timeout: 5000 });
    await page.locator('.ck-sq.can').first().click();
    await page.locator('.ck-sq.target').first().click();
  }
  await expect(page.locator('.ck-sq.last')).not.toHaveCount(0);
  expect(await page.locator('.ck-piece.p1').count()).toBeGreaterThan(0);
});

test('pong: points are scored and pausing freezes play', async ({ page }) => {
  await startGame(page, 'pong', { difficulty: 'Hard' });
  await page.keyboard.down('w');
  await expect(page.locator('.pong-score')).not.toContainText('You 0', { timeout: 20_000 }).catch(() => undefined);
  await expect.poll(async () => (await page.locator('.pong-score').innerText()).match(/\d+/g)!.map(Number).reduce((a, b) => a + b), { timeout: 20_000 }).toBeGreaterThan(0);
  await page.keyboard.up('w');
  await page.keyboard.press('p');
  const frozen = await page.locator('.pong-score').innerText();
  await page.waitForTimeout(3000);
  expect(await page.locator('.pong-score').innerText()).toBe(frozen);
});

test('arcade works fully offline after the app is installed and records stats', async ({ page, context }) => {
  await page.goto('/arcade');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await context.setOffline(true);
  await page.getByRole('link', { name: 'Connect Four' }).click();
  await page.getByRole('button', { name: 'Got it' }).click();
  await page.getByRole('button', { name: '2 players (this device)', exact: true }).click();
  await page.locator('.arcade-play').click();
  for (const c of [3, 4, 3, 4, 3, 4, 3]) await page.getByRole('button', { name: `Column ${c}`, exact: true }).click();
  await expect(overlay(page)).toContainText('Player 1 wins!');
  await page.getByRole('button', { name: 'Quit' }).last().click();
  await expect(page.locator('.arcade-stats')).toContainText('1');
  await context.setOffline(false);
});

test('arcade is translated and mirrored in Arabic', async ({ page }) => {
  await page.goto('/arcade');
  await page.getByLabel('App language').selectOption('ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { name: /صالة الألعاب/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'الثعبان' })).toBeVisible();
});

test('arcade pages have no serious accessibility violations', async ({ page }) => {
  for (const [path, scheme] of [['/arcade', 'dark'], ['/arcade', 'light'], ['/arcade/sudoku', 'dark']] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const serious = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(serious.map((v) => `${path} (${scheme}): ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target}`)).toEqual([]);
  }
});
