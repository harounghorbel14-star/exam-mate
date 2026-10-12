import { test, expect, type Browser, type Page } from '@playwright/test';

const uid = () => Math.random().toString(36).slice(2, 8);

/** Each player is an independent browser context: separate cookies, storage and WebSocket. */
async function player(browser: Browser, name: string): Promise<Page> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('/register');
  await page.getByLabel('Display name').fill(name);
  await page.getByLabel('Email').fill(`mp-${uid()}@example.test`);
  await page.getByLabel('Password').fill('a long enough password');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/onboarding/);
  return page;
}

async function createRoom(host: Page, game: string) {
  await host.goto('/play');
  await host.getByRole('button', { name: new RegExp(game) }).first().click();
  await host.getByRole('button', { name: 'Create a room' }).click();
  await expect(host.getByTestId('room-code')).toHaveText(/^[A-Z2-9]{6}$/);
  await expect(host).toHaveURL(/\/play\/[A-Z2-9]{6}$/);
  return (await host.getByTestId('room-code').innerText()).trim();
}

test('two independent clients play a real-time tic-tac-toe game to the end', async ({ browser }) => {
  const alice = await player(browser, 'Alice');
  const bob = await player(browser, 'Bob');
  const code = await createRoom(alice, 'Tic-Tac-Toe');
  // Bob follows the invite link.
  await bob.goto(`/play/${code}`);
  await expect(bob.getByText('Alice')).toBeVisible();
  await expect(alice.getByText('Bob')).toBeVisible();
  await expect(alice.getByRole('button', { name: /Start game/ })).toBeDisabled();
  await bob.getByRole('button', { name: "I'm ready" }).click();
  await alice.getByRole('button', { name: /Start game/ }).click();
  await expect(alice.getByText('Your turn')).toBeVisible();
  await expect(bob.getByText("Alice's turn")).toBeVisible();
  // Bob cannot move out of turn: the cells are disabled for him.
  await expect(bob.getByRole('gridcell', { name: 'Row 1, column 1', exact: true })).toBeDisabled();
  const play = async (p: Page, r: number, c: number) => {
    await p.getByRole('gridcell', { name: `Row ${r}, column ${c}`, exact: true }).click();
  };
  await play(alice, 1, 1);
  await expect(bob.getByRole('gridcell', { name: 'Row 1, column 1: X' })).toBeVisible();
  // Bob drops his connection mid-game and comes back to the same seat.
  await bob.reload();
  await expect(bob.getByText('Your turn')).toBeVisible();
  await expect(bob.getByRole('gridcell', { name: 'Row 1, column 1: X' })).toBeVisible();
  await play(bob, 2, 1);
  await expect(alice.getByText('Your turn')).toBeVisible();
  await play(alice, 1, 2);
  await expect(bob.getByText('Your turn')).toBeVisible();
  await play(bob, 2, 2);
  await expect(alice.getByText('Your turn')).toBeVisible();
  await play(alice, 1, 3);
  await expect(alice.getByTestId('mp-result')).toHaveText('You won!');
  await expect(bob.getByTestId('mp-result')).toHaveText('Alice wins!');
  // Rematch returns both players to the lobby.
  await alice.getByRole('button', { name: /Play again/ }).click();
  await expect(bob.getByRole('button', { name: "I'm ready" })).toBeVisible();
});

test('three players complete a trivia party; answers are hidden until the reveal', async ({ browser }) => {
  const players = [await player(browser, 'Ana'), await player(browser, 'Ben'), await player(browser, 'Cy')];
  await players[0]!.goto('/play');
  await players[0]!.getByRole('button', { name: /Trivia/ }).click();
  await players[0]!.getByLabel('Players').selectOption('3');
  await players[0]!.getByRole('button', { name: 'Create a room' }).click();
  await expect(players[0]!.getByTestId('room-code')).toHaveText(/^[A-Z2-9]{6}$/);
  const code = (await players[0]!.getByTestId('room-code').innerText()).trim();
  for (const p of players.slice(1)) {
    await p.goto('/play');
    await p.getByLabel('Room code').fill(code.toLowerCase());
    await p.getByRole('button', { name: 'Join', exact: true }).click();
    await p.getByRole('button', { name: "I'm ready" }).click();
  }
  await players[0]!.getByRole('button', { name: /Start game/ }).click();
  for (let q = 1; q <= 7; q++) {
    for (const p of players) await expect(p.getByText(`Question ${q}/7`)).toBeVisible({ timeout: 20_000 });
    // Everyone answers the first choice; the server reveals when all have answered.
    for (const p of players) await p.locator('.choice').first().click();
    await expect(players[0]!.locator('.choice.correct')).toHaveCount(1, { timeout: 5000 });
  }
  for (const p of players) await expect(p.getByTestId('mp-result')).toBeVisible({ timeout: 20_000 });
});
