import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const startedAt = Date.now();

// Cheap liveness check — confirms the deployment is up and reports which
// integrations are wired by env presence. Does not call out to providers,
// so it's safe to hit at any cadence (uptime monitors, Vercel health).
export async function GET() {
  const checks = {
    db: Boolean(process.env.DATABASE_URL),
    supabase:
      Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
      Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    ai_gateway: Boolean(process.env.AI_GATEWAY_API_KEY),
    stripe: Boolean(process.env.STRIPE_SECRET_KEY),
    blob: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    sentry: Boolean(process.env.SENTRY_DSN),
  };
  return NextResponse.json(
    {
      status: 'ok',
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev',
      env: process.env.VERCEL_ENV ?? 'development',
      uptimeMs: Date.now() - startedAt,
      checks,
    },
    {
      headers: { 'cache-control': 'no-store' },
    },
  );
}
