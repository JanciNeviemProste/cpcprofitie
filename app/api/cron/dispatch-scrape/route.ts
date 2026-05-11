import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import {
  ALL_SOURCES,
  getSource,
  recordScrapeRun,
  runScrape,
  upsertListings,
} from '@/lib/scraping';

// Vercel Cron entry point. Iterates registered sources sequentially with
// per-source try/catch isolation: one source failing (HTTP, parse, persist)
// does NOT kill the rest. Scheduled in vercel.ts as `0 */6 * * *` (requires
// Vercel Pro plan for sub-daily cadence).
export const runtime = 'nodejs';
export const maxDuration = 300;

const PROD = process.env.VERCEL_ENV === 'production';

// Pages per source per cron run. Keep low so we fit under maxDuration=300s
// with ~1.5s crawl-delay × 4 sources × N pages.
const PAGES_PER_RUN = 5;

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

  type PerSource = {
    source: string;
    status: 'succeeded' | 'failed';
    listingsFound: number;
    counts?: { added: number; updated: number; skipped: number };
    errors: string[];
  };
  const summary: PerSource[] = [];

  for (const id of ALL_SOURCES) {
    try {
      const result = await runScrape(getSource(id), { pages: PAGES_PER_RUN });
      const counts = await upsertListings(result.listings);
      await recordScrapeRun(id, result, counts);
      summary.push({
        source: id,
        status: result.errors.length === 0 ? 'succeeded' : 'failed',
        listingsFound: result.listings.length,
        counts,
        errors: result.errors,
      });
    } catch (e) {
      console.error('cron_scrape_source_failed', {
        source: id,
        error: e instanceof Error ? e.message : e,
      });
      Sentry.captureException(e, {
        tags: { component: 'scraper' },
        extra: { source: id },
      });
      summary.push({
        source: id,
        status: 'failed',
        listingsFound: 0,
        errors: [e instanceof Error ? e.message : 'unknown error'],
      });
    }
  }

  return NextResponse.json({
    dispatchedAt: new Date().toISOString(),
    summary,
  });
}
