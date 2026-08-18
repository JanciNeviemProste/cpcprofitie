import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { isConnectionError } from '@/lib/db/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const startedAt = Date.now();

// How long the deep probe waits before calling the database dead. Short on
// purpose: this endpoint is polled by uptime monitors, so it must fail fast
// rather than hold a connection open.
const DEEP_PROBE_TIMEOUT_MS = 4000;

// Cheap liveness check — confirms the deployment is up and reports which
// integrations are wired by env presence. Does not call out to providers,
// so it's safe to hit at any cadence (uptime monitors, Vercel health).
//
// `?deep=1` additionally runs `select 1` against Postgres. Env presence alone
// is not liveness: during CPCPROFIT-8 this endpoint reported `db: true` for 13
// days while the Supabase project behind DATABASE_URL no longer existed, so an
// uptime monitor pointed here stayed green through a total outage. The probe is
// opt-in so the default path stays free.
//
// Status semantics:
//   ok       — all REQUIRED integrations are wired
//   degraded — some optional integration missing
//   error    — a required integration is missing (production), or the deep
//              probe could not reach Postgres
export async function GET(request: Request) {
  const deep = new URL(request.url).searchParams.get('deep') === '1';

  const checks = {
    db: Boolean(
      process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? process.env.POSTGRES_URL_NON_POOLING,
    ),
    supabase:
      Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
      Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    ai_gateway: Boolean(process.env.AI_GATEWAY_API_KEY),
    stripe: Boolean(process.env.STRIPE_SECRET_KEY),
    blob: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    sentry: Boolean(process.env.SENTRY_DSN),
  };

  // Only meaningful when a URL is configured at all — without one there is
  // nothing to probe and `db: false` already says so.
  let dbProbe: { reachable: boolean; latencyMs?: number; error?: string } | undefined;
  if (deep && checks.db) {
    const probeStart = Date.now();
    try {
      await withTimeout(getDb().execute(sql`select 1`), DEEP_PROBE_TIMEOUT_MS);
      dbProbe = { reachable: true, latencyMs: Date.now() - probeStart };
    } catch (e) {
      checks.db = false;
      dbProbe = {
        reachable: false,
        latencyMs: Date.now() - probeStart,
        // Distinguishes "server is gone" from "the query itself broke".
        error: isConnectionError(e) ? 'connection_failed' : 'query_failed',
      };
    }
  }

  const env = process.env.VERCEL_ENV ?? 'development';
  const required: Array<keyof typeof checks> = env === 'production' ? ['db', 'supabase'] : [];
  const missingRequired = required.filter((k) => !checks[k]);
  const missingOptional = (Object.keys(checks) as Array<keyof typeof checks>).filter(
    (k) => !checks[k] && !required.includes(k),
  );

  // An unreachable database is an outage in every environment, not just
  // production — otherwise a preview deploy pointed at a dead DB reads green.
  const probeFailed = dbProbe?.reachable === false;
  const status: 'ok' | 'degraded' | 'error' =
    missingRequired.length > 0 || probeFailed
      ? 'error'
      : missingOptional.length > 0
        ? 'degraded'
        : 'ok';

  return NextResponse.json(
    {
      status,
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev',
      env,
      uptimeMs: Date.now() - startedAt,
      missingRequired,
      missingOptional,
      checks,
      ...(dbProbe ? { dbProbe } : {}),
    },
    {
      status: status === 'error' ? 503 : 200,
      headers: { 'cache-control': 'no-store' },
    },
  );
}

/** postgres.js honours its own connect_timeout (30s by default) — far too long
 *  for a health endpoint, so race it against our own deadline. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`health probe timed out after ${ms}ms`)), ms),
    ),
  ]);
}
