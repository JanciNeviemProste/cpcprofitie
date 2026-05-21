import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import {
  ALL_SOURCES,
  getSource,
  persistDetails,
  recordScrapeRun,
  runEnrichment,
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

// Per-source budget tuned to stay under 300s function timeout when running
// scrape + enrichment together. Manual catch-up triggers (?source=X&startPage=N)
// can still go wider since they hit one source at a time.
const PAGES_PER_RUN = 30;
const ENRICH_LIMIT_PER_RUN = 40;

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
    enrichment?: { fetched: number; detailsUpserted: number; photosInserted: number };
    errors: string[];
  };
  const summary: PerSource[] = [];

  // Optional ?source=X filter — lets callers run a single source so that the
  // 300s function budget applies per source rather than to the whole sweep.
  // Useful for the (now multi-step) manual catch-up flow; the scheduled cron
  // hits this without a filter and runs all sources serially.
  const url = new URL(request.url);
  const sourceFilter = url.searchParams.get('source');
  const startPageParam = Number(url.searchParams.get('startPage') ?? '1');
  const startPage = Number.isFinite(startPageParam) && startPageParam >= 1
    ? Math.floor(startPageParam)
    : 1;
  const sources = sourceFilter
    ? ALL_SOURCES.filter((s) => s === sourceFilter)
    : ALL_SOURCES;

  for (const id of sources) {
    try {
      const source = getSource(id);
      const result = await runScrape(source, {
        pages: PAGES_PER_RUN,
        startPage,
      });
      const counts = await upsertListings(result.listings);
      await recordScrapeRun(id, result, counts);

      let enrichment: PerSource['enrichment'];
      if (source.parseDetailPage) {
        // Stay with the default 40-per-run enrich budget. Bumping to 100 for
        // a single-source manual catch-up pushed bazos.eu past the 300s
        // function timeout (~210s of fetches + parse + DB upserts).
        const enrichLimit = ENRICH_LIMIT_PER_RUN;
        const enrichResult = await runEnrichment(source, result.listings, {
          limit: enrichLimit,
        });
        const detailCounts = await persistDetails(enrichResult.details);
        enrichment = {
          fetched: enrichResult.fetched,
          detailsUpserted: detailCounts.detailsUpserted,
          photosInserted: detailCounts.photosInserted,
        };
        if (enrichResult.errors.length > 0) {
          console.warn('enrichment_partial', {
            source: id,
            errorsSample: enrichResult.errors.slice(0, 3),
          });
        }
      }

      summary.push({
        source: id,
        status: result.errors.length === 0 ? 'succeeded' : 'failed',
        listingsFound: result.listings.length,
        counts,
        enrichment,
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

  // 502 if any source failed — Vercel Cron Dashboard then surfaces it red
  // instead of pretending everything's fine. Critical for not silently
  // regressing to the "weeks of zero data" pattern.
  const anyFailed = summary.some((s) => s.status === 'failed');
  return NextResponse.json(
    { dispatchedAt: new Date().toISOString(), summary },
    { status: anyFailed ? 502 : 200 },
  );
}
