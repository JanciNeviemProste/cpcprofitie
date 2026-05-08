import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GET } from '../route';

const ENV_KEYS = [
  'DATABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'AI_GATEWAY_API_KEY',
  'STRIPE_SECRET_KEY',
  'BLOB_READ_WRITE_TOKEN',
  'SENTRY_DSN',
  'VERCEL_ENV',
] as const;

describe('GET /api/health', () => {
  let snapshot: Record<string, string | undefined>;

  beforeEach(() => {
    snapshot = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
    for (const k of ENV_KEYS) delete process.env[k];
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      const v = snapshot[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('returns degraded with optional integrations missing in dev', async () => {
    const res = await GET();
    const body = (await res.json()) as { status: string; checks: Record<string, boolean> };
    expect(res.status).toBe(200);
    expect(body.status).toBe('degraded');
    expect(body.checks).toMatchObject({
      db: false,
      supabase: false,
      ai_gateway: false,
      stripe: false,
      blob: false,
      sentry: false,
    });
  });

  it('returns 503 with status:error in production when required integrations are missing', async () => {
    process.env.VERCEL_ENV = 'production';
    const res = await GET();
    const body = (await res.json()) as { status: string; missingRequired: string[] };
    expect(res.status).toBe(503);
    expect(body.status).toBe('error');
    expect(body.missingRequired).toEqual(expect.arrayContaining(['db', 'supabase']));
  });

  it('returns ok when required integrations are wired in production', async () => {
    process.env.VERCEL_ENV = 'production';
    process.env.DATABASE_URL = 'postgres://localhost/test';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
    const res = await GET();
    const body = (await res.json()) as { status: string };
    expect(res.status).toBe(200);
    expect(body.status).toBe('degraded'); // optionals still missing
    expect(body).not.toHaveProperty('missingRequired', expect.arrayContaining(['db']));
  });

  it('sets cache-control: no-store', async () => {
    const res = await GET();
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});
