import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const startedAt = Date.now();

// Cheap liveness check — confirms the deployment is up and reports which
// integrations are wired by env presence. Does not call out to providers,
// so it's safe to hit at any cadence (uptime monitors, Vercel health).
//
// Status semantics:
//   ok       — all REQUIRED integrations are wired
//   degraded — some optional integration missing
//   error    — a required integration is missing in production
export async function GET() {
  const checks = {
    db: Boolean(
      process.env.DATABASE_URL ??
        process.env.POSTGRES_URL ??
        process.env.POSTGRES_URL_NON_POOLING,
    ),
    supabase:
      Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
      Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    ai_gateway: Boolean(process.env.AI_GATEWAY_API_KEY),
    stripe: Boolean(process.env.STRIPE_SECRET_KEY),
    blob: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    sentry: Boolean(process.env.SENTRY_DSN),
  };

  const env = process.env.VERCEL_ENV ?? 'development';
  const required: Array<keyof typeof checks> = env === 'production' ? ['db', 'supabase'] : [];
  const missingRequired = required.filter((k) => !checks[k]);
  const missingOptional = (Object.keys(checks) as Array<keyof typeof checks>).filter(
    (k) => !checks[k] && !required.includes(k),
  );

  const status: 'ok' | 'degraded' | 'error' =
    missingRequired.length > 0 ? 'error' : missingOptional.length > 0 ? 'degraded' : 'ok';

  return NextResponse.json(
    {
      status,
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev',
      env,
      uptimeMs: Date.now() - startedAt,
      missingRequired,
      missingOptional,
      checks,
    },
    {
      status: status === 'error' ? 503 : 200,
      headers: { 'cache-control': 'no-store' },
    },
  );
}
