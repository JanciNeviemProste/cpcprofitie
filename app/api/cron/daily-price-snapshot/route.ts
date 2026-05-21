import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';

// Daily snapshot of current asking prices for active (not sold, not removed)
// listings. Idempotent on (listing_id, recorded_on) via ON CONFLICT DO NOTHING.
export const runtime = 'nodejs';
export const maxDuration = 300;

const PROD = process.env.VERCEL_ENV === 'production';

export async function POST(request: Request) {
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
    const result = await db.execute(sql`
      INSERT INTO listing_price_history (listing_id, recorded_on, price_eur)
      SELECT id, CURRENT_DATE, price_eur
      FROM listings
      WHERE price_eur IS NOT NULL
        AND sold_at IS NULL
        AND removed_at IS NULL
      ON CONFLICT DO NOTHING
    `);
    const insertedRows =
      (result as { rowCount?: number | null }).rowCount ?? 0;
    return NextResponse.json({
      insertedRows,
      elapsedMs: Date.now() - startedAt,
    });
  } catch (e) {
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
