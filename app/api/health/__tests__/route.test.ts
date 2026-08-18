import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../route';

/** The route reads searchParams, so every call needs a real Request. */
function req(query = ''): Request {
  return new Request('http://localhost/api/health' + query);
}

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
    const res = await GET(req());
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
    const res = await GET(req());
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
    const res = await GET(req());
    const body = (await res.json()) as { status: string };
    expect(res.status).toBe(200);
    expect(body.status).toBe('degraded'); // optionals still missing
    expect(body).not.toHaveProperty('missingRequired', expect.arrayContaining(['db']));
  });

  it('sets cache-control: no-store', async () => {
    const res = await GET(req());
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});

// The deep probe is the guard against the CPCPROFIT-8 blind spot: env presence
// reported db:true for 13 days while Postgres was unreachable.
describe('GET /api/health?deep=1', () => {
  const snapshot: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of ENV_KEYS) {
      snapshot[k] = process.env[k];
      delete process.env[k];
    }
    vi.resetModules();
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      const v = snapshot[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    vi.doUnmock('@/lib/db');
  });

  it('skips the probe when no connection string is configured', async () => {
    const res = await GET(req('?deep=1'));
    const body = (await res.json()) as { dbProbe?: unknown };
    expect(body.dbProbe).toBeUndefined();
  });

  it('reports 503 + connection_failed when Postgres is unreachable', async () => {
    process.env.DATABASE_URL = 'postgres://localhost/test';
    vi.doMock('@/lib/db', () => ({
      getDb: () => ({
        execute: () => Promise.reject(Object.assign(new Error('boom'), { code: 'ENOTFOUND' })),
      }),
    }));
    const { GET: freshGet } = await import('../route');
    const res = await freshGet(req('?deep=1'));
    const body = (await res.json()) as {
      status: string;
      checks: { db: boolean };
      missingRequired: string[];
      dbProbe: { reachable: boolean; error: string };
    };
    expect(res.status).toBe(503);
    expect(body.status).toBe('error');
    expect(body.dbProbe).toMatchObject({ reachable: false, error: 'connection_failed' });
    // checks.db means "a connection string is configured", which it still is.
    // Collapsing it with reachability made missingRequired claim the env var
    // was absent — the opposite diagnosis to "the server is gone".
    expect(body.checks.db).toBe(true);
    expect(body.missingRequired).not.toContain('db');
  });

  it('labels a hung connection as a timeout, not a query failure', async () => {
    process.env.DATABASE_URL = 'postgres://localhost/test';
    vi.doMock('@/lib/db', () => ({
      getDb: () => ({ execute: () => new Promise(() => {}) }), // never settles
    }));
    const { GET: freshGet } = await import('../route');
    const res = await freshGet(req('?deep=1'));
    const body = (await res.json()) as { dbProbe: { error: string } };
    expect(res.status).toBe(503);
    expect(body.dbProbe.error).toBe('timeout');
  }, 15_000);

  it('reports reachable when select 1 succeeds', async () => {
    process.env.DATABASE_URL = 'postgres://localhost/test';
    vi.doMock('@/lib/db', () => ({ getDb: () => ({ execute: () => Promise.resolve([]) }) }));
    const { GET: freshGet } = await import('../route');
    const res = await freshGet(req('?deep=1'));
    const body = (await res.json()) as { checks: { db: boolean }; dbProbe: { reachable: boolean } };
    expect(res.status).toBe(200);
    expect(body.checks.db).toBe(true);
    expect(body.dbProbe.reachable).toBe(true);
  });
});
