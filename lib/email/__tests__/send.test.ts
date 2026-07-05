import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getEmailFrom, isEmailLive, sendEmailBatch } from '../send';

describe('sendEmailBatch (mock mode)', () => {
  beforeEach(() => {
    vi.stubEnv('RESEND_API_KEY', '');
    delete process.env.RESEND_API_KEY;
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reports mock mode without the API key', () => {
    expect(isEmailLive()).toBe(false);
  });

  it('skips all sends without throwing when no key is configured', async () => {
    const result = await sendEmailBatch([
      { to: 'a@example.com', subject: 'Test', html: '<p>hi</p>' },
      { to: 'b@example.com', subject: 'Test', html: '<p>hi</p>' },
    ]);
    expect(result).toEqual({ sent: 0, skipped: 2, errors: 0, mode: 'mock', sentTo: [] });
  });

  it('returns zeros for an empty batch', async () => {
    const result = await sendEmailBatch([]);
    expect(result.sent).toBe(0);
    expect(result.errors).toBe(0);
  });
});

describe('getEmailFrom', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('falls back to the Resend onboarding sender', () => {
    delete process.env.EMAIL_FROM;
    expect(getEmailFrom()).toBe('CPCProfit <onboarding@resend.dev>');
  });

  it('prefers EMAIL_FROM when set', () => {
    vi.stubEnv('EMAIL_FROM', 'CPCProfit <alerts@cpcprofit.sk>');
    expect(getEmailFrom()).toBe('CPCProfit <alerts@cpcprofit.sk>');
  });
});
