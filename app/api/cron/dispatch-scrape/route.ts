import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { DbUnavailableError } from '@/lib/db/errors';
import {
  ALL_SOURCES,
  closeScrapeRun,
  getSource,
  openScrapeRun,
  runScrape,
  upsertListings,
  type Source,
} from '@/lib/scraping';
import { advanceCursor, loadCursor, pickSource } from '@/lib/scraping/rotation';

// Vercel Cron entry point.
//
// One source per invocation, and the page window moves.
//
// It used to loop all three sources inside one 300s function with startPage
// pinned to 1, which had two consequences. Every run re-read pages 1–30 of each
// source — the same ~600 of 78 775 listings — so anything deeper was refreshed
// never, and a price could sit unverified indefinitely while the freshness
// numbers looked fine. And whichever source came last in the loop was killed by
// the function ceiling before it ran: bazos.sk missed two runs out of three,
// leaving no scrape_runs row, no error, and nothing anywhere to notice.
//
// A run with exactly one source cannot half-finish its list, and a cursor that
// advances means the whole corpus comes round.
export const runtime = 'nodejs';
export const maxDuration = 300;

const PROD = process.env.VERCEL_ENV === 'production';

// Pages per invocation. Enrichment used to eat ~240s of the budget from inside
// this route; it now runs as its own cron, so the walk gets the time.
const PAGES_PER_RUN = 80;
// Stop with enough room to persist, advance the cursor and close the run row.
// Being killed mid-flight is what made the old failure invisible.
const TIME_BUDGET_MS = 240_000;

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

  const startedAt = Date.now();
  const url = new URL(request.url);

  // ?source= pins the source (the cron schedules one per entry, and manual
  // catch-ups target one at a time). Without it, the clock picks — so an
  // unparameterised call still rotates instead of always hitting the same one.
  const sourceFilter = url.searchParams.get('source') as Source | null;
  const id: Source =
    sourceFilter && (ALL_SOURCES as readonly string[]).includes(sourceFilter)
      ? sourceFilter
      : pickSource(ALL_SOURCES, new Date());

  // ?startPage= overrides the cursor for a manual catch-up. The cursor still
  // advances from wherever the run ends, so a manual jump is not undone.
  const startPageParam = Number(url.searchParams.get('startPage') ?? '');
  const startPageOverride =
    Number.isFinite(startPageParam) && startPageParam >= 1 ? Math.floor(startPageParam) : null;

  const pagesParam = Number(url.searchParams.get('pages') ?? '');
  const pages =
    Number.isFinite(pagesParam) && pagesParam >= 1
      ? Math.min(500, Math.floor(pagesParam))
      : PAGES_PER_RUN;

  let runId: bigint | null = null;
  try {
    const source = getSource(id);
    const cursor = await loadCursor(id, source.maxPage ?? null);
    const startPage = startPageOverride ?? cursor.nextPage;
    const endPage = startPage + pages - 1;

    // Opened before the work, so a function killed mid-run leaves a `running`
    // row that ages into an alert instead of leaving nothing at all.
    runId = await openScrapeRun(id, { startPage, endPage, cycleNo: cursor.cycleNo });

    const result = await runScrape(source, {
      pages,
      startPage,
      deadline: startedAt + TIME_BUDGET_MS,
    });
    const counts = await upsertListings(result.listings);

    const pagesOk = result.outcomes.filter((o) => o.kind === 'ok').length;
    const pagesEmpty = result.outcomes.filter((o) => o.kind === 'empty').length;
    const pagesNotFound = result.outcomes.filter((o) => o.kind === 'notFound').length;
    const pagesError = result.outcomes.filter((o) => o.kind === 'error').length;

    // Advanced only now, with the listings already persisted.
    const advanced = await advanceCursor(id, cursor, {
      lastPage: Math.max(result.lastPage, startPage - 1),
      endOfCatalog: result.stoppedReason === 'endOfCatalog',
      failed: pagesOk === 0 && pagesError > 0,
    });

    await closeScrapeRun(runId, id, result, counts, {
      startPage,
      endPage: Math.max(result.lastPage, startPage - 1),
      pagesOk,
      pagesEmpty,
      pagesNotFound,
      pagesError,
      cycleNo: cursor.cycleNo,
      stoppedReason: result.stoppedReason,
    });

    if (advanced.forcedPastFailure) {
      Sentry.captureMessage(`Scrape cursor forced past a repeatedly failing page on ${id}`, {
        level: 'error',
        tags: { component: 'scraper' },
        extra: { source: id, startPage, nextPage: advanced.nextPage },
      });
    }

    const body = {
      dispatchedAt: new Date().toISOString(),
      source: id,
      startPage,
      lastPage: result.lastPage,
      nextPage: advanced.nextPage,
      cycleNo: advanced.cycleNo,
      cycleWrapped: advanced.wrapped,
      stoppedReason: result.stoppedReason,
      pages: { ok: pagesOk, empty: pagesEmpty, notFound: pagesNotFound, error: pagesError },
      listingsFound: result.listings.length,
      counts,
      errors: result.errors.slice(0, 5),
      elapsedMs: Date.now() - startedAt,
    };

    // Red only when pages genuinely failed. Running off the end of a source is
    // the normal outcome of a healthy rotation — reporting that as a failure
    // would turn this signal into noise within a week, right when it becomes
    // the thing that tells us a source has broken.
    return NextResponse.json(body, { status: pagesError > 0 && pagesOk === 0 ? 502 : 200 });
  } catch (e) {
    if (e instanceof DbUnavailableError) {
      return NextResponse.json({ error: 'db_unavailable', source: id }, { status: 503 });
    }
    console.error('cron_scrape_source_failed', {
      source: id,
      error: e instanceof Error ? e.message : e,
    });
    Sentry.captureException(e, { tags: { component: 'scraper' }, extra: { source: id } });
    return NextResponse.json(
      { error: 'scrape_failed', source: id, message: e instanceof Error ? e.message : 'unknown' },
      { status: 502 },
    );
  }
}

export const POST = GET;
