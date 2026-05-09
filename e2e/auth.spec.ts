import { expect, test } from '@playwright/test';

test.describe('Auth UI', () => {
  test('login page shows Google sign-in and ToS link', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /Prihlásenie do CPCProfit/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Pokračovať s Google/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /obchodnými podmienkami/i })).toBeVisible();
  });

  test('signup page links back to login', async ({ page }) => {
    await page.goto('/signup');
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

  test('health endpoint reports degraded in dev (no integrations wired)', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { status: string; checks: Record<string, boolean> };
    expect(['ok', 'degraded']).toContain(body.status);
    expect(body.checks).toHaveProperty('db');
    expect(body.checks).toHaveProperty('supabase');
  });
});
