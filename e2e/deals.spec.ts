import { expect, test } from '@playwright/test';

// /app/deals is publicly viewable (PUBLIC_APP_PREFIXES in proxy.ts). The
// dataset depends on the weekly cron, so assertions tolerate both a populated
// grid and the empty state.
test.describe('Deals 2.0', () => {
  test('renders masthead, filters, and either deals or the empty state', async ({ page }) => {
    await page.goto('/app/deals');
    await expect(page.getByRole('heading', { name: /pod cenou/i })).toBeVisible();

    const emptyState = page.getByText(/Trh je dnes vyrovnaný/i);
    const kpiTicker = page.getByText(/Ø skóre/i);
    await expect(emptyState.or(kpiTicker).first()).toBeVisible();
  });

  test('minScore filter round-trips through the URL', async ({ page }) => {
    await page.goto('/app/deals?minScore=90');
    await expect(page).toHaveURL(/minScore=90/);
    await expect(page.getByRole('heading', { name: /pod cenou/i })).toBeVisible();
  });

  test('invalid searchParams do not crash the page', async ({ page }) => {
    await page.goto('/app/deals?minScore=abc&sources=nonsense&maxBudget=-5');
    await expect(page.getByRole('heading', { name: /pod cenou/i })).toBeVisible();
  });
});
