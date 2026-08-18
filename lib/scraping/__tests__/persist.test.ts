import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NormalizedListing } from '../types';

const captureException = vi.fn();
vi.mock('@sentry/nextjs', () => ({ captureException: (...a: unknown[]) => captureException(...a) }));

// Counts every query the persist layer attempts, and controls whether it fails.
const state = { selects: 0, fail: null as Error | null };

function thenable() {
  state.selects++;
  const result = state.fail ? Promise.reject(state.fail) : Promise.resolve([]);
  const chain: Record<string, unknown> = {
    from: () => chain,
    where: () => chain,
    limit: () => result,
    then: (...a: unknown[]) => (result as Promise<unknown>).then(...(a as [])),
    catch: (...a: unknown[]) => (result as Promise<unknown>).catch(...(a as [])),
  };
  return chain;
}

vi.mock('@/lib/db', () => ({
  getDb: () => ({
    select: () => thenable(),
    insert: () => ({
      values: () => ({
        onConflictDoNothing: () => (state.fail ? Promise.reject(state.fail) : Promise.resolve([])),
        onConflictDoUpdate: () => ({
          returning: () => (state.fail ? Promise.reject(state.fail) : Promise.resolve([])),
        }),
      }),
    }),
  }),
}));

import { DbUnavailableError, __resetDbAvailability } from '@/lib/db/errors';
import { __resetModelCache, upsertListings } from '../persist';

function row(i: number): NormalizedListing {
  // 480 listings across 40 models — the shape that produced `Promise.all
  // (index 480)` in CPCPROFIT-8.
  const model = `mitsubishi-model-${i % 40}`;
  return {
    source: 'bazos.sk',
    sourceId: `id-${i}`,
    url: `https://auto.bazos.sk/inzerat/${i}`,
    makeSlug: 'mitsubishi',
    modelSlug: model,
    priceEur: 10_000,
    year: 2019,
    mileageKm: 120_000,
    fuel: 'diesel',
    transmission: 'manual',
    region: 'SK-Bratislavský',
    rawTitle: `Mitsubishi Model ${i % 40}`,
    rawPayload: {},
  };
}

const ROWS = Array.from({ length: 480 }, (_, i) => row(i));

beforeEach(() => {
  process.env.DATABASE_URL = 'postgres://localhost/test';
  state.selects = 0;
  state.fail = null;
  captureException.mockClear();
  __resetModelCache();
  __resetDbAvailability();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  delete process.env.DATABASE_URL;
  vi.restoreAllMocks();
});

describe('upsertListings when Postgres is unreachable', () => {
  const outage = () => Object.assign(new Error('(ENOTFOUND) tenant/user postgres.x not found'), {
    code: 'ENOTFOUND',
  });

  it('aborts the batch instead of returning a successful-looking result', async () => {
    state.fail = outage();
    await expect(upsertListings(ROWS)).rejects.toBeInstanceOf(DbUnavailableError);
  });

  it('reports exactly one Sentry event for 480 listings', async () => {
    state.fail = outage();
    await expect(upsertListings(ROWS)).rejects.toThrow();
    expect(captureException).toHaveBeenCalledTimes(1);
  });

  it('stops after a handful of queries rather than one per listing', async () => {
    state.fail = outage();
    await expect(upsertListings(ROWS)).rejects.toThrow();
    // Bounded by MODEL_RESOLVE_CONCURRENCY (8), not by 480.
    expect(state.selects).toBeLessThanOrEqual(8);
  });
});

describe('upsertListings when the database is healthy', () => {
  it('resolves each distinct model once, not once per listing', async () => {
    await upsertListings(ROWS);
    // 40 distinct models x (lookup + re-select after insert), plus the make.
    // The old per-row fan-out issued 480+ instead; measured here at 96.
    expect(state.selects).toBeGreaterThan(0);
    expect(state.selects).toBeLessThanOrEqual(120);
  });

  it('does not report a query-level failure as an outage', async () => {
    state.fail = Object.assign(new Error('duplicate key value'), { code: '23505' });
    // Swallowed per-model exactly as before: the batch still completes.
    await expect(upsertListings(ROWS)).resolves.toMatchObject({ added: 0 });
    expect(captureException).toHaveBeenCalled();
    const [, opts] = captureException.mock.calls[0]!;
    expect(opts).toMatchObject({ tags: { component: 'persist' } });
  });
});

// Regression: deduplicating by modelSlug must not let a row whose make failed
// to parse poison siblings that parsed fine. autobazar.eu sets makeSlug and
// modelSlug independently (lib/scraping/sources/autobazar-eu.ts:130-131), so a
// batch can hold both shapes for the same slug, in scrape-page order.
describe('model dedup across rows with differing makeSlug', () => {
  function pair(): NormalizedListing[] {
    const base = row(0);
    return [
      // Make failed to parse — ensureModelId bails before touching the DB.
      { ...base, sourceId: 'a', modelSlug: 'outlander', makeSlug: null },
      // Same slug, make parsed fine — must still resolve.
      { ...base, sourceId: 'b', modelSlug: 'outlander', makeSlug: 'mitsubishi' },
    ];
  }

  it('resolves the slug when any row in the batch carries a usable makeSlug', async () => {
    await upsertListings(pair());
    // A lookup only happens when a usable makeSlug was found.
    expect(state.selects).toBeGreaterThan(0);
  });

  it('resolves regardless of which row comes first', async () => {
    await upsertListings(pair().reverse());
    expect(state.selects).toBeGreaterThan(0);
  });
});

// Regression: an outage must not leave the process permanently degraded.
// A module-level "db is down" flag made every later batch return an empty map
// with no worker throwing — 200 OK, zero Sentry events, every listing written
// with model_id = null. Silently worse than the bug this file exists to fix.
describe('recovery after an outage in the same process', () => {
  it('resolves models normally once the database comes back', async () => {
    state.fail = Object.assign(new Error('(ENOTFOUND) tenant/user postgres.x not found'), {
      code: 'ENOTFOUND',
    });
    await expect(upsertListings(ROWS)).rejects.toBeInstanceOf(DbUnavailableError);

    // Database recovers. Deliberately do NOT reset the module state — that is
    // the whole point: a warm lambda keeps serving with it still set.
    state.fail = null;
    state.selects = 0;
    await expect(upsertListings(ROWS)).resolves.toMatchObject({ skipped: 0 });
    expect(state.selects).toBeGreaterThan(0);
  });
});
