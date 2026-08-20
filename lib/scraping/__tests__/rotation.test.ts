import { describe, expect, it } from 'vitest';
import { nextCursorPosition, pickSource } from '../rotation';
import type { Source } from '../types';

const base = {
  nextPage: 1,
  pageSpace: null as number | null,
  maxKnownPage: null as number | null,
  cycleNo: 1,
  consecutiveFailures: 0,
};

// Every case here is a way the rotation can be broken while still looking like
// "the scraper is running" — which is exactly how the original bug survived:
// startPage stayed 1 for months and every run reported success.
describe('nextCursorPosition', () => {
  it('moves on from where the run actually finished', () => {
    const r = nextCursorPosition(
      { ...base, nextPage: 1 },
      { lastPage: 80, endOfCatalog: false, failed: false },
    );
    expect(r.nextPage).toBe(81);
    expect(r.wrapped).toBe(false);
    expect(r.cycleNo).toBe(1);
  });

  it('advances by pages covered, not pages requested', () => {
    // The run asked for 80 pages and the deadline cut it off at 41. Advancing
    // by the request would skip 39 pages that nothing would ever come back for.
    const r = nextCursorPosition(
      { ...base, nextPage: 100 },
      { lastPage: 141, endOfCatalog: false, failed: false },
    );
    expect(r.nextPage).toBe(142);
  });

  it('wraps at the end of the catalogue and starts a new cycle', () => {
    const r = nextCursorPosition(
      { ...base, nextPage: 940, pageSpace: null },
      { lastPage: 955, endOfCatalog: true, failed: false },
    );
    expect(r.nextPage).toBe(1);
    expect(r.wrapped).toBe(true);
    expect(r.cycleNo).toBe(2);
    // Depth is learned, so the next cycle knows where the end is.
    expect(r.maxKnownPage).toBe(955);
  });

  it('wraps at a declared page space without needing to hit 404s', () => {
    // autobazar.eu takes its page number modulo the bucket count, so walking
    // past the end silently re-reads the beginning. Without the declared bound
    // the cursor would climb for ever and report progress it never made.
    const r = nextCursorPosition(
      { ...base, nextPage: 6700, pageSpace: 6776 },
      { lastPage: 6776, endOfCatalog: false, failed: false },
    );
    expect(r.nextPage).toBe(1);
    expect(r.wrapped).toBe(true);
    expect(r.cycleNo).toBe(2);
  });

  it('holds position when a run fails, so the slice is retried not skipped', () => {
    const r = nextCursorPosition(
      { ...base, nextPage: 200 },
      { lastPage: 203, endOfCatalog: false, failed: true },
    );
    expect(r.nextPage).toBe(200);
    expect(r.consecutiveFailures).toBe(1);
    expect(r.forcedPastFailure).toBe(false);
  });

  it('steps over a page that fails every time rather than wedging for ever', () => {
    // Holding position is right for a transient outage and fatal for a page
    // that is simply broken: the cursor would pin there and starve the entire
    // rest of the corpus while every run still reported "ran".
    const r = nextCursorPosition(
      { ...base, nextPage: 200, consecutiveFailures: 2 },
      { lastPage: 203, endOfCatalog: false, failed: true },
    );
    expect(r.forcedPastFailure).toBe(true);
    expect(r.nextPage).toBeGreaterThan(200);
    expect(r.consecutiveFailures).toBe(0);
  });

  it('clears the failure count once a run succeeds', () => {
    const r = nextCursorPosition(
      { ...base, nextPage: 200, consecutiveFailures: 2 },
      { lastPage: 279, endOfCatalog: false, failed: false },
    );
    expect(r.consecutiveFailures).toBe(0);
    expect(r.nextPage).toBe(280);
  });

  it('keeps a learned depth across a normal run', () => {
    const r = nextCursorPosition(
      { ...base, nextPage: 100, maxKnownPage: 955 },
      { lastPage: 179, endOfCatalog: false, failed: false },
    );
    expect(r.maxKnownPage).toBe(955);
  });
});

describe('pickSource', () => {
  const sources = ['autobazar.eu', 'autobazar.sk', 'bazos.sk'] as unknown as readonly Source[];

  it('gives every source a turn', () => {
    const picked = new Set(
      Array.from({ length: 6 }, (_, h) => pickSource(sources, new Date(h * 3_600_000))),
    );
    expect(picked.size).toBe(3);
  });

  it('is stable within an hour and moves on the next', () => {
    const a = pickSource(sources, new Date(5 * 3_600_000));
    const b = pickSource(sources, new Date(5 * 3_600_000 + 59 * 60_000));
    const c = pickSource(sources, new Date(6 * 3_600_000));
    expect(a).toBe(b);
    expect(c).not.toBe(a);
  });
});
