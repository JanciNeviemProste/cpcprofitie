import { expect, test } from '@playwright/test';

test.describe('GDPR cookies banner', () => {
  test('appears on first visit and disappears after choice', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/');
    const banner = page.getByText(/Cookies a súkromie/i);
    await expect(banner).toBeVisible();

    await page.getByRole('button', { name: /Iba nevyhnutné/i }).click();
    await expect(banner).toBeHidden();

    // Reloading must NOT bring it back — preference persisted.
    await page.reload();
    await expect(page.getByText(/Cookies a súkromie/i)).toBeHidden();
  });

  test('Prijať všetko persists analytics+marketing flags', async ({ page, context }) => {
    await context.clearCookies();
    await page.addInitScript(() => localStorage.removeItem('cpcprofit-consent'));
    await page.goto('/');
    await page.getByRole('button', { name: /Prijať všetko/i }).click();

    const stored = await page.evaluate(() => localStorage.getItem('cpcprofit-consent'));
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored ?? '{}') as {
      analytics: boolean;
      marketing: boolean;
      version: number;
    };
    expect(parsed.analytics).toBe(true);
    expect(parsed.marketing).toBe(true);
    expect(parsed.version).toBe(1);
  });
});
