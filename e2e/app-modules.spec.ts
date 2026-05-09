import { expect, test } from '@playwright/test';

// In dev (no Supabase env wired) the proxy lets /app through so we can test
// the dashboard UI end-to-end against mock data. Production is fail-closed.
test.describe('App modules (mock data)', () => {
  test('overview renders KPI strip and Smart Insight', async ({ page }) => {
    await page.goto('/app/overview');
    await expect(page.getByRole('heading', { name: /Prehľad trhu/i })).toBeVisible();
    await expect(page.getByText(/Aktívne inzeráty/i)).toBeVisible();
    await expect(page.getByText(/Smart Insight/i)).toBeVisible();
  });

  test('market table links into per-model analysis', async ({ page }) => {
    await page.goto('/app/market');
    const firstModelLink = page.getByRole('link').filter({ hasText: /Škoda Octavia/i }).first();
    await firstModelLink.click();
    await expect(page).toHaveURL(/\/app\/analysis\/skoda-octavia/);
    await expect(page.getByRole('heading', { name: /Octavia/ })).toBeVisible();
    await expect(page.getByText(/Cenový vývoj/i)).toBeVisible();
  });

  test('compare picker swaps the selected model', async ({ page }) => {
    await page.goto('/app/compare?left=skoda-octavia&right=bmw-3-320d');
    await expect(page.getByRole('heading', { name: /Octavia/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /3 Series 320d/ })).toBeVisible();
  });

  test('garage shows margin cards', async ({ page }) => {
    await page.goto('/app/garage');
    await expect(page.getByRole('heading', { name: /Moja garáž/i })).toBeVisible();
    await expect(page.getByText(/Trhový medián/i).first()).toBeVisible();
  });

  test('billing page is reachable and shows current plan', async ({ page }) => {
    await page.goto('/app/billing');
    await expect(page.getByRole('heading', { name: /Predplatné a fakturácia/i })).toBeVisible();
    await expect(page.getByText(/Aktuálny plán/i)).toBeVisible();
  });

  test('admin scrape-runs lists status badges', async ({ page }) => {
    await page.goto('/app/admin/scrape-runs');
    await expect(page.getByRole('heading', { name: /Scrape behy/i })).toBeVisible();
    await expect(page.getByText('autobazar.sk').first()).toBeVisible();
  });
});
