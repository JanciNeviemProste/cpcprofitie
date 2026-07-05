import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { toBigInt } from '@/lib/db/bigint';
import { USER_AGENT } from '@/lib/scraping';

// Daily HEAD-check cron — runs 03:00 UTC. Walks 1/7 of active listings per
// day so the full population gets refreshed once a week. Listings that 404 /
// 410 are marked removedAt (= seller pulled the ad; not necessarily sold).
// soldAt is set heuristically when the URL redirects to the "sold" page on
// sources that have one (we leave that to the source plugin in v2).
//
// autobazar.eu is excluded — its sitemap is the canonical liveness signal
// (handled in the weekly sweep). Only bazos.sk and autobazar.sk need explicit
// HEAD-checking. Together that's ~21k listings, ~3k/day, ~1h with 1.2s delay.
export const runtime = 'nodejs';
export const maxDuration = 300;

const PROD = process.env.VERCEL_ENV === 'production';
const CRAWL_DELAY_MS = 1200;
const HEAD_TIMEOUT_MS = 8000;
const SOURCES_TO_CHECK = ['bazos.sk', 'autobazar.sk'] as const;

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    if (PROD) {
      return NextResponse.json({ error: 'cron_secret_unset' }, { status: 503 });
    }
  } else {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const db = getDb();
  const url = new URL(request.url);
  const dayOfWeek = new Date().getUTCDay(); // 0=Sun..6=Sat — partitions 1/7 per day
  const dryRun = url.searchParams.get('dryRun') === '1';
  const maxBatch = Number(url.searchParams.get('maxBatch') ?? '3000');

  // Pull this day's slice of active listings via deterministic partitioning.
  // (id::int % 7) maps a listing to one of 7 buckets so each gets checked
  // once a week regardless of scrape timing.
  const candidates = (await db.execute(sql`
    SELECT id, url, source
    FROM listings
    WHERE source = ANY(${sql`${SOURCES_TO_CHECK as unknown as string[]}::text[]`})
      AND sold_at IS NULL
      AND removed_at IS NULL
      AND (id::bigint % 7) = ${dayOfWeek}
    ORDER BY last_seen_at ASC
    LIMIT ${maxBatch}
  `)) as unknown as Array<{ id: string | number | bigint; url: string; source: string }>;

  const stats = {
    dayOfWeek,
    candidates: candidates.length,
    checked: 0,
    markedRemoved: 0,
    stillLive: 0,
    errors: 0,
  };

  if (dryRun) {
    return NextResponse.json({ dryRun: true, stats });
  }

  for (const row of candidates) {
    try {
      const ac = AbortSignal.timeout(HEAD_TIMEOUT_MS);
      const res = await fetch(row.url, {
        method: 'HEAD',
        redirect: 'manual',
        signal: ac,
        headers: { 'User-Agent': USER_AGENT },
      });
      stats.checked++;
      if (res.status === 404 || res.status === 410) {
        await db.execute(sql`
          UPDATE listings SET removed_at = now() WHERE id = ${toBigInt(row.id)}
        `);
        stats.markedRemoved++;
      } else if (res.status >= 200 && res.status < 400) {
        await db.execute(sql`
          UPDATE listings SET last_seen_at = now() WHERE id = ${toBigInt(row.id)}
        `);
        stats.stillLive++;
      }
    } catch (e) {
      stats.errors++;
      Sentry.captureException(e, {
        tags: { component: 'check-removed', source: row.source },
        extra: { listingId: String(row.id) },
      });
    }
    await sleep(CRAWL_DELAY_MS);
  }

  // 502 if more than half the checks errored — partial failure shouldn't
  // mark the cron green.
  const tooManyErrors = stats.checked > 0 && stats.errors > stats.checked / 2;
  return NextResponse.json(
    { runAt: new Date().toISOString(), stats },
    { status: tooManyErrors ? 502 : 200 },
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
