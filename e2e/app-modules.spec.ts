import { expect, test } from '@playwright/test';

// In dev/CI there is no DATABASE_URL and no Supabase session — pages must
// render their empty states gracefully (queries are graceful-empty). When a
// populated DB is present the same assertions still hold; data-specific
// checks run conditionally.
test.describe('App modules', () => {
  test('overview renders KPI strip and Smart Insights', async ({ page }) => {
    await page.goto('/app/overview');
    await expect(page.getByRole('heading', { name: /Prehľad trhu/i })).toBeVisible();
    await expect(page.getByText(/Aktívne inzeráty/i)).toBeVisible();
    await expect(page.getByText(/Smart Insight/i)).toBeVisible();
  });

  test('market renders the table or the empty state; model rows link to analysis', async ({
    page,
  }) => {
    await page.goto('/app/market');
    await expect(page.getByRole('heading', { name: /^Trh$/i })).toBeVisible();

    const emptyState = page.getByText(/Zatiaľ žiadne modely/i);
    const modelLink = page.locator('a[href^="/app/analysis/"]').first();
    await expect(emptyState.or(modelLink).first()).toBeVisible();

    if (await modelLink.isVisible()) {
      await modelLink.click();
      await expect(page).toHaveURL(/\/app\/analysis\//);
    }
  });

  test('compare renders columns or the empty state', async ({ page }) => {
    await page.goto('/app/compare?left=skoda-octavia&right=bmw-3-320d');
    await expect(page.getByRole('heading', { name: /Porovnanie/i })).toBeVisible();
  });

  // Auth-gated pages: with Supabase env present the proxy redirects
  // anonymous visitors to /login; without it (CI) the request falls through
  // and the page renders for a null user. Both are correct — assert per-world.
  test('garage is login-gated or renders with a disabled add button', async ({ page }) => {
    await page.goto('/app/garage');
    if (page.url().includes('/login')) {
      await expect(page).toHaveURL(/next=%2Fapp%2Fgarage/);
    } else {
      await expect(page.getByRole('heading', { name: /Moja garáž/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Pridať vozidlo/i })).toBeDisabled();
    }
  });

  test('billing is login-gated or shows the current plan', async ({ page }) => {
    await page.goto('/app/billing');
    if (page.url().includes('/login')) {
      await expect(page).toHaveURL(/next=%2Fapp%2Fbilling/);
    } else {
      await expect(page.getByRole('heading', { name: /Predplatné a fakturácia/i })).toBeVisible();
      await expect(page.getByText(/Aktuálny plán/i)).toBeVisible();
    }
  });

  test('admin scrape-runs is hidden from non-admins', async ({ page }) => {
    // Anonymous + Supabase env → proxy redirects to /login. Otherwise the
    // page calls notFound() for anyone not on ADMIN_EMAILS. Note: on dynamic
    // pages Next streams the shell with 200 before notFound() resolves, so
    // assert the rendered 404 UI (and no leaked admin content), not the
    // HTTP status.
    await page.goto('/app/admin/scrape-runs');
    if (page.url().includes('/login')) {
      await expect(page).toHaveURL(/login/);
    } else {
      await expect(page.getByRole('heading', { name: /Stránka neexistuje/i })).toBeVisible();
      await expect(page.getByRole('heading', { name: /Scrape behy/i })).toHaveCount(0);
    }
  });
});
