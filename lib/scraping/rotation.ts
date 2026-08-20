// Where the page walk has got to, per source.
//
// The cron used to call runScrape with startPage = 1 on every invocation, so it
// re-read pages 1–30 of each source for ever — about 600 of 78 775 listings —
// and everything deeper was refreshed never. runScrape had supported startPage
// all along, complete with a comment saying it existed to "resume across
// multiple invocations". Nothing advanced it.
//
// Why a stored cursor rather than a function of the clock, which is how
// check-removed spreads its work: check-removed partitions on listing id, and
// an id is stable, so a missed day costs those rows one cycle and the mapping
// stays correct. A page index is the opposite — a shifting coordinate over a
// moving population, where new listings push everything down and editing a
// source's bucket list renumbers the whole space. A stateless f(now) would skip
// a killed run's slice permanently, which is the same silent coverage hole this
// exists to close.

import { eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { scrapeCursors } from '@/lib/db/schema';
import type { Source } from './types';

export type Cursor = {
  source: Source;
  nextPage: number;
  pageSpace: number | null;
  maxKnownPage: number | null;
  cycleNo: number;
  consecutiveFailures: number;
};

/** Force the cursor past a page that keeps failing, rather than wedging there
 *  for ever. Three runs is enough to tell a transient outage from a page that
 *  is simply broken. */
const MAX_CONSECUTIVE_FAILURES = 3;

export async function loadCursor(source: Source, pageSpace: number | null): Promise<Cursor> {
  const db = getDb();
  const rows = (await db.execute(sql`
    INSERT INTO scrape_cursors (source, page_space)
    VALUES (${source}, ${pageSpace})
    ON CONFLICT (source) DO UPDATE SET source = EXCLUDED.source
    RETURNING source, next_page, page_space, max_known_page, cycle_no, consecutive_failures
  `)) as unknown as Array<{
    source: string;
    next_page: number;
    page_space: number | null;
    max_known_page: number | null;
    cycle_no: number;
    consecutive_failures: number;
  }>;
  const r = rows[0]!;

  // The source redefined its page space (a bucket list was regenerated, brands
  // were added). Page numbers now mean something different, so the old position
  // is meaningless — start a fresh cycle rather than carry a stale coordinate.
  if (pageSpace != null && r.page_space !== pageSpace) {
    await db
      .update(scrapeCursors)
      .set({
        nextPage: 1,
        pageSpace,
        maxKnownPage: null,
        cycleNo: r.cycle_no + 1,
        cycleStartedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(scrapeCursors.source, source));
    return {
      source,
      nextPage: 1,
      pageSpace,
      maxKnownPage: null,
      cycleNo: r.cycle_no + 1,
      consecutiveFailures: r.consecutive_failures,
    };
  }

  return {
    source,
    nextPage: r.next_page,
    pageSpace: r.page_space,
    maxKnownPage: r.max_known_page,
    cycleNo: r.cycle_no,
    consecutiveFailures: r.consecutive_failures,
  };
}

export type AdvanceInput = {
  /** Highest page the run actually reached. */
  lastPage: number;
  /** True when the source ran out of pages — wrap to the start. */
  endOfCatalog: boolean;
  /** True when the run produced no usable page at all. */
  failed: boolean;
};

export type AdvanceResult = {
  nextPage: number;
  cycleNo: number;
  wrapped: boolean;
  forcedPastFailure: boolean;
};

/**
 * Where the cursor goes next — the whole decision, with no database in it.
 *
 * Split out because this is the part that can be wrong in ways production would
 * hide: a cursor that never wraps stops covering the corpus, one that wraps too
 * early re-reads the head for ever, and one that sticks on a failing page
 * starves everything behind it. All three look like "the scraper is running".
 */
export function nextCursorPosition(
  current: Pick<Cursor, 'nextPage' | 'pageSpace' | 'maxKnownPage' | 'cycleNo' | 'consecutiveFailures'>,
  input: AdvanceInput,
): AdvanceResult & { maxKnownPage: number | null; consecutiveFailures: number } {
  if (input.failed) {
    const failures = current.consecutiveFailures + 1;
    const forced = failures >= MAX_CONSECUTIVE_FAILURES;
    return {
      nextPage: forced
        ? Math.max(current.nextPage + 1, input.lastPage + 1)
        : current.nextPage,
      cycleNo: current.cycleNo,
      wrapped: false,
      forcedPastFailure: forced,
      maxKnownPage: current.maxKnownPage,
      consecutiveFailures: forced ? 0 : failures,
    };
  }

  const learnedMax = input.endOfCatalog
    ? Math.max(1, input.lastPage)
    : (current.maxKnownPage ?? null);
  const candidate = input.lastPage + 1;
  const bound = current.pageSpace ?? learnedMax ?? null;
  const wrapped = input.endOfCatalog || (bound != null && candidate > bound);

  return {
    nextPage: wrapped ? 1 : candidate,
    cycleNo: wrapped ? current.cycleNo + 1 : current.cycleNo,
    wrapped,
    forcedPastFailure: false,
    maxKnownPage: learnedMax,
    consecutiveFailures: 0,
  };
}

/**
 * Move the cursor on, AFTER the pages have been persisted.
 *
 * Order matters: if a run dies between fetching and saving, the cursor still
 * points at the slice it was working on and the next run redoes it. Redoing a
 * slice costs a few page fetches; skipping one leaves a hole in the corpus that
 * nothing will ever come back for.
 */
export async function advanceCursor(
  source: Source,
  current: Cursor,
  input: AdvanceInput,
): Promise<AdvanceResult> {
  const db = getDb();
  const next = nextCursorPosition(current, input);

  await db
    .update(scrapeCursors)
    .set({
      nextPage: next.nextPage,
      maxKnownPage: next.maxKnownPage,
      cycleNo: next.cycleNo,
      ...(next.wrapped ? { cycleStartedAt: new Date() } : {}),
      consecutiveFailures: next.consecutiveFailures,
      updatedAt: new Date(),
    })
    .where(eq(scrapeCursors.source, source));

  return {
    nextPage: next.nextPage,
    cycleNo: next.cycleNo,
    wrapped: next.wrapped,
    forcedPastFailure: next.forcedPastFailure,
  };
}

/**
 * Which source this invocation should handle.
 *
 * One source per run, chosen by the clock. The old cron looped all three inside
 * a single 300s function, and whichever came last was killed before it ran —
 * bazos.sk missed two runs out of three, leaving no row and raising no error.
 * A run with exactly one job cannot half-finish its list.
 */
export function pickSource(sources: readonly Source[], at: Date): Source {
  const slot = Math.floor(at.getTime() / (60 * 60 * 1000));
  return sources[slot % sources.length]!;
}
