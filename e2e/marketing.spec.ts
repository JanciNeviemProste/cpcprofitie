import { expect, test } from '@playwright/test';

test.describe('Marketing landing', () => {
  test('renders hero, features, pricing and FAQ sections', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /zaručenou maržou/i })).toBeVisible();
    await expect(page.getByText(/Sedem nástrojov/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /Jednoduché ceny/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Časté otázky/i })).toBeVisible();
  });

  test('all three pricing tier CTAs are present', async ({ page }) => {
    await page.goto('/#pricing');
    await expect(page.getByRole('link', { name: /Začať skúšobné obdobie/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Zvoliť Plus/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Zvoliť Premium/i })).toBeVisible();
  });

  test('legal pages are reachable from the footer', async ({ page }) => {
    await page.goto('/');
    const termsLink = page.getByRole('link', { name: /Obchodné podmienky/i }).first();
    await termsLink.click();
    await expect(page).toHaveURL(/\/legal\/terms/);
    await expect(page.getByRole('heading', { name: /Obchodné podmienky/i })).toBeVisible();
  });

  test('sitemap and robots are served', async ({ request }) => {
    const sitemap = await request.get('/sitemap.xml');
    expect(sitemap.status()).toBe(200);
    const robots = await request.get('/robots.txt');
    expect(robots.status()).toBe(200);
    const robotsBody = await robots.text();
    expect(robotsBody).toContain('Disallow: /app/');
  });
});
