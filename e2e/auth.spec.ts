import { expect, test } from '@playwright/test';

test.describe('Auth UI', () => {
  test('login page shows email/password form and ToS link', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /Prihlásenie do CPCProfit/i })).toBeVisible();
    await expect(page.getByLabel(/E-mail/i)).toBeVisible();
    await expect(page.getByLabel(/^Heslo$/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Prihlásiť sa/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /obchodnými podmienkami/i })).toBeVisible();
  });

  test('register page links back to login', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: /Vytvorte si účet/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Prihlásiť sa/i })).toBeVisible();
  });

  test('sign-out endpoint refuses cross-origin POST', async ({ request }) => {
    const res = await request.post('/auth/sign-out', {
      headers: { origin: 'https://evil.example.com' },
      maxRedirects: 0,
    });
    expect(res.status()).toBe(403);
  });

  test('health endpoint reports integration status', async ({ request }) => {
    const res = await request.get('/api/health');
    const body = (await res.json()) as {
      status: string;
      env: string;
      checks: Record<string, boolean>;
    };
    if (body.env === 'production') {
      // Local dev with a pulled prod .env.local (VERCEL_ENV=production) —
      // required integrations may be absent, so 503/error is the honest answer.
      expect([200, 503]).toContain(res.status());
      expect(['ok', 'degraded', 'error']).toContain(body.status);
    } else {
      expect(res.status()).toBe(200);
      expect(['ok', 'degraded']).toContain(body.status);
    }
    expect(body.checks).toHaveProperty('db');
    expect(body.checks).toHaveProperty('supabase');
  });
});
