import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { detectSoldListings } from '@/lib/analytics/sold-detector';

// Nightly sweep: walk listings with removed_at set and decide sold vs relisted.
// Caps at maxBatches * batchSize listings/run so we always fit in Vercel's
// 300s budget. Idempotent — once sold_at is set the row is skipped forever.
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

  const startedAt = Date.now();
  try {
    const stats = await detectSoldListings({ batchSize: 500, maxBatches: 20 });
    const elapsedMs = Date.now() - startedAt;
    if (stats.errors > 0) {
      return NextResponse.json({ stats, elapsedMs }, { status: 502 });
    }
    return NextResponse.json({ stats, elapsedMs });
  } catch (e) {
    Sentry.captureException(e, { tags: { component: 'detect-sold-cron' } });
    return NextResponse.json(
      {
        error: 'detect_sold_failed',
        message: e instanceof Error ? e.message : String(e),
        elapsedMs: Date.now() - startedAt,
      },
      { status: 500 },
    );
  }
}

// Also support POST for manual invocations from local driver scripts.
export const POST = GET;
