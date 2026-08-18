import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { DbUnavailableError, dbCall } from '@/lib/db/errors';

// Daily snapshot of current asking prices for active (not sold, not removed)
// listings. Idempotent on (listing_id, recorded_on) via ON CONFLICT DO NOTHING.
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
    const db = getDb();
    const result = await dbCall(
      () =>
        db.execute(sql`
      INSERT INTO listing_price_history (listing_id, recorded_on, price_eur)
      SELECT id, CURRENT_DATE, price_eur
      FROM listings
      WHERE price_eur IS NOT NULL
        AND sold_at IS NULL
        AND removed_at IS NULL
      ON CONFLICT DO NOTHING
    `),
      { step: 'daily-price-snapshot' },
    );
    const insertedRows =
      (result as { rowCount?: number | null }).rowCount ?? 0;
    return NextResponse.json({
      insertedRows,
      elapsedMs: Date.now() - startedAt,
    });
  } catch (e) {
    if (e instanceof DbUnavailableError) {
      // noteDbUnavailable() already sent the single report for this run.
      return NextResponse.json({ error: 'db_unavailable' }, { status: 503 });
    }
    Sentry.captureException(e, {
      tags: { component: 'daily-price-snapshot' },
    });
    return NextResponse.json(
      {
        error: 'snapshot_failed',
        message: e instanceof Error ? e.message : String(e),
        elapsedMs: Date.now() - startedAt,
      },
      { status: 500 },
    );
  }
}

// Vercel Cron invokes cron paths via GET; keep POST for manual/scripted runs.
export const POST = GET;
