import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { runWeeklyDigest } from '@/lib/notifications/weekly-digest';

// Weekly market digest (Mon 07:00 UTC via vercel.json) for users with at
// least one e-mail-enabled watchlist entry. Without RESEND_API_KEY runs in
// mock mode. `?dryRun=1` reports the recipient count without sending.
export const runtime = 'nodejs';
export const maxDuration = 300;

const PROD = process.env.VERCEL_ENV === 'production';

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    if (PROD) return NextResponse.json({ error: 'cron_secret_unset' }, { status: 503 });
  } else {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get('dryRun') === '1';

  const startedAt = Date.now();
  try {
    const stats = await runWeeklyDigest({ dryRun });
    const elapsedMs = Date.now() - startedAt;
    if (stats.errors > 0) {
      return NextResponse.json({ stats, elapsedMs }, { status: 502 });
    }
    return NextResponse.json({ stats, elapsedMs });
  } catch (e) {
    Sentry.captureException(e, { tags: { component: 'weekly-digest-cron' } });
    return NextResponse.json(
      {
        error: 'weekly_digest_failed',
        message: e instanceof Error ? e.message : String(e),
        elapsedMs: Date.now() - startedAt,
      },
      { status: 500 },
    );
  }
}

// Also support POST for manual invocations from local driver scripts.
export const POST = GET;
