import { test, expect } from '@playwright/test';
import { createHmac } from 'node:crypto';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Decode(s: string) {
  let bits = 0, value = 0; const out: number[] = [];
  for (const ch of s.replace(/\s/g, '')) { value = (value << 5) | B32.indexOf(ch); bits += 5; if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  return Buffer.from(out);
}
/** What an authenticator app shows, computed independently of the server code. */
function totp(secret: string, offsetSteps = 0) {
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000) + offsetSteps));
  const mac = createHmac('sha1', base32Decode(secret)).update(msg).digest();
  const o = mac[mac.length - 1]! & 15;
  return String((mac.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

test('turn on two-factor authentication, then sign in with an app code and with a recovery code', async ({ page }) => {
  const email = `mfa-${Math.random().toString(36).slice(2, 8)}@example.test`;
  const password = 'a long enough password';
  await page.goto('/register');
  await page.getByLabel('Display name').fill('MFA Student');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/onboarding/);

  await page.goto('/settings');
  await page.getByRole('button', { name: 'Turn on two-factor authentication' }).click();
  await page.getByLabel('Confirm your password').fill(password);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('img', { name: 'QR code' }).locator('svg')).toBeVisible();
  const secret = (await page.getByTestId('mfa-secret').innerText()).replace(/\s/g, '');
  expect(secret).toMatch(/^[A-Z2-7]{32}$/);
  await page.getByLabel('6-digit code').fill(totp(secret));
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page.getByTestId('recovery-codes').locator('li')).toHaveCount(10);
  const codes = (await page.getByTestId('recovery-codes').locator('li').allInnerTexts()).map((c) => c.trim());
  expect(codes).toHaveLength(10);
  await page.getByRole('button', { name: 'I have saved them' }).click();
  await expect(page.getByText('10 recovery codes left')).toBeVisible();

  // Sign out, then sign in: the password alone is not enough.
  await page.getByRole('button', { name: 'Log out' }).click();
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('heading', { name: 'Enter your code' })).toBeVisible();
  await page.getByLabel('6-digit code').fill('000000');
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page.getByRole('alert')).toHaveText('That code is not valid. Try the newest code from your app.');
  // The enable step consumed the current time step, so use the next one (accepted within ±1 step drift).
  await page.getByLabel('6-digit code').fill(totp(secret, 1));
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page).not.toHaveURL(/login/);
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: /Two-factor authentication/ })).toBeVisible();
  await expect(page.getByText('10 recovery codes left')).toBeVisible();

  // Recovery code path.
  await page.getByRole('button', { name: 'Log out' }).click();
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.getByRole('button', { name: 'Use a recovery code instead' }).click();
  await page.getByLabel('Recovery code').fill(codes[0]!);
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page).not.toHaveURL(/login/);
  await page.goto('/settings');
  await expect(page.getByText('9 recovery codes left')).toBeVisible();
});
