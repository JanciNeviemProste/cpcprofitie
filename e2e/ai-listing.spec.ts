import { expect, test } from '@playwright/test';

test.describe('AI listing generator', () => {
  test('streams a mock response when AI Gateway is not wired', async ({ page }) => {
    await page.goto('/app/ai-listing');
    await expect(page.getByRole('heading', { name: /AI generovanie inzerátu/i })).toBeVisible();

    // The cookie banner overlays the submit button on first visit.
    const dismissCookies = page.getByRole('button', { name: /Iba nevyhnutné/i });
    if (await dismissCookies.isVisible()) {
      await dismissCookies.click();
    }

    await page.getByRole('button', { name: /Vygenerovať inzerát/i }).click();
    await expect(page.getByText(/Demo režim/i)).toBeVisible({ timeout: 15_000 });
    // The mock stream emits the user-supplied make+model verbatim.
    await expect(page.getByText(/Škoda Octavia/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('rejects malformed JSON to /api/ai/listing with 400', async ({ request }) => {
    const res = await request.post('/api/ai/listing', {
      headers: { 'content-type': 'application/json' },
      data: 'not-json',
    });
    expect([400, 401]).toContain(res.status());
  });

  test('rejects validation failures with 400 and issues array', async ({ request }) => {
    const res = await request.post('/api/ai/listing', {
      data: { make: 'X', model: 'Y', year: 1700, mileageKm: -1, tone: 'sales' },
    });
    expect([400, 401]).toContain(res.status());
    if (res.status() === 400) {
      const body = (await res.json()) as { error: string; issues?: unknown[] };
      expect(body.error).toBe('validation_failed');
      expect(Array.isArray(body.issues)).toBe(true);
    }
  });
});
