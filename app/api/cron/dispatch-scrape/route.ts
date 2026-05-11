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

const PAGES_PER_RUN = 20;
const ENRICH_LIMIT_PER_RUN = 20;

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

  for (const id of ALL_SOURCES) {
    try {
      const source = getSource(id);
      const result = await runScrape(source, { pages: PAGES_PER_RUN });
      const counts = await upsertListings(result.listings);
      await recordScrapeRun(id, result, counts);

      let enrichment: PerSource['enrichment'];
      if (source.parseDetailPage) {
        const enrichResult = await runEnrichment(source, result.listings, {
          limit: ENRICH_LIMIT_PER_RUN,
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

  return NextResponse.json({
    dispatchedAt: new Date().toISOString(),
    summary,
  });
}
