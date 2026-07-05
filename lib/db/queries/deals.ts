// Read-side query helpers for the /app/deals 2.0 UI.
//
// Joins flip_opportunities × listings × vehicle_models × vehicle_makes × hero
// photo and exposes a typed DealCard shape. New columns from migration 0009
// (deal_score, score_breakdown, explainer, est_recond_eur, est_profit_eur) are
// optional in the result — rows from before the migration ran will have NULL
// values which are filled with a single fallback definition below.

import * as Sentry from '@sentry/nextjs';
import { sql } from 'drizzle-orm';
import { getDb } from '../index';
import { estimateProfit } from '@/lib/analytics/deal-score';
import { SK_KRAJE, krajByName } from '@/lib/data/sk-regions';
import type { Source } from '@/lib/scraping/types';

export type ScoreBreakdown = {
  discount?: number;
  cohort?: number;
  seller?: number;
  photo?: number;
  recency?: number;
};

/**
 * Per-listing deal lookup. Powers the DealScore banner on `/app/listings/[id]`.
 * Returns null when:
 *   - no row in flip_opportunities for this listing, OR
 *   - row exists but `deal_score` is NULL (weekly enrichment hasn't run yet).
 * Callers should hide the banner in either case.
 */
export type DealForListing = {
  dealScore: number;
  marketMedianEur: number;
  marketP25Eur: number;
  discountPct: number;
  estProfitEur: number;
  estRecondEur: number;
  cohortSize: number;
  confidence: 'low' | 'medium' | 'high';
  explainer: string;
  scoreBreakdown: {
    discount: number;
    cohort: number;
    seller: number;
    photo: number;
    recency: number;
  };
};

export function normalizeBreakdown(raw: unknown): DealForListing['scoreBreakdown'] {
  const fallback = { discount: 0, cohort: 0, seller: 0, photo: 0, recency: 0 };
  if (!raw || typeof raw !== 'object') return fallback;
  const obj = raw as Record<string, unknown>;
  const num = (k: string) => {
    const v = obj[k];
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
  };
  return {
    discount: num('discount'),
    cohort: num('cohort'),
    seller: num('seller'),
    photo: num('photo'),
    recency: num('recency'),
  };
}

// Single fallback profit path for rows the weekly cron hasn't enriched yet —
// must match what computeFlipOpportunities persists (estimateProfit, incl.
// the 5% transaction fee; may be negative for thin deals).
export function fallbackProfit(
  marketMedianEur: number,
  priceEur: number | null,
  estRecondEur: number | null,
): number {
  return estimateProfit(priceEur ?? 0, marketMedianEur, estRecondEur ?? 800);
}

export async function getDealForListing(
  listingId: bigint,
): Promise<DealForListing | null> {
  try {
    return await getDealForListingUnsafe(listingId);
  } catch (e) {
    // Graceful-empty on DB unavailability, matching the other query modules —
    // a missing banner beats a 500 on the listing detail.
    Sentry.captureException(e, { tags: { component: 'deals', step: 'getDealForListing' } });
    return null;
  }
}

async function getDealForListingUnsafe(
  listingId: bigint,
): Promise<DealForListing | null> {
  const db = getDb();
  const rows = (await db.execute(sql`
    SELECT
      fo.deal_score,
      fo.market_median_eur::float8 AS market_median_eur,
      fo.market_p25_eur::float8 AS market_p25_eur,
      fo.discount_pct::float8 AS discount_pct,
      fo.est_profit_eur,
      fo.est_recond_eur,
      fo.cohort_size,
      fo.confidence,
      fo.explainer,
      fo.score_breakdown,
      fo.potential_gain_eur::float8 AS potential_gain_eur,
      l.price_eur::float8 AS price_eur
    FROM flip_opportunities fo
    JOIN listings l ON l.id = fo.listing_id
    WHERE fo.listing_id = ${listingId}
    LIMIT 1
  `)) as unknown as Array<{
    deal_score: number | null;
    market_median_eur: number;
    market_p25_eur: number;
    discount_pct: number;
    est_profit_eur: number | null;
    est_recond_eur: number | null;
    cohort_size: number;
    confidence: 'low' | 'medium' | 'high';
    explainer: string | null;
    score_breakdown: unknown;
    potential_gain_eur: number;
    price_eur: number;
  }>;

  if (rows.length === 0) return null;
  const r = rows[0];
  if (r.deal_score == null) return null; // pre-enrichment row — hide banner

  const recond = r.est_recond_eur ?? 800;
  const estProfit =
    r.est_profit_eur ?? fallbackProfit(r.market_median_eur, r.price_eur, recond);

  return {
    dealScore: r.deal_score,
    marketMedianEur: Math.round(r.market_median_eur),
    marketP25Eur: Math.round(r.market_p25_eur),
    discountPct: Math.round(r.discount_pct * 10) / 10,
    estProfitEur: estProfit,
    estRecondEur: recond,
    cohortSize: r.cohort_size,
    confidence: r.confidence,
    explainer: r.explainer ?? '',
    scoreBreakdown: normalizeBreakdown(r.score_breakdown),
  };
}

export type DealCard = {
  listingId: bigint;
  source: Source;
  url: string;
  rawTitle: string | null;
  makeName: string | null;
  modelName: string | null;
  year: number | null;
  mileageKm: number | null;
  region: string | null;
  priceEur: number | null;
  heroPhotoUrl: string | null;
  dealScore: number;
  scoreBreakdown: ScoreBreakdown | null;
  marketMedianEur: number;
  marketP25Eur: number;
  discountPct: number;
  potentialGainEur: number;
  estProfitEur: number;
  estRecondEur: number;
  explainer: string;
  cohortSize: number;
  confidence: 'low' | 'medium' | 'high';
  sellerType: 'private' | 'dealer' | null;
};

export type GetTopDealsOpts = {
  limit?: number;
  minScore?: number;
  sources?: Source[];
  regions?: string[]; // kraj names
  maxBudget?: number;
  /** Only rows already enriched with deal_score (used by the landing page). */
  enrichedOnly?: boolean;
};

export function buildFallbackExplainer(row: {
  discountPct: number;
  marketMedianEur: number;
  cohortSize: number;
  confidence: 'low' | 'medium' | 'high';
}): string {
  const disc = Math.round(row.discountPct);
  const conf =
    row.confidence === 'high'
      ? 'vysoká istota'
      : row.confidence === 'medium'
        ? 'stredná istota'
        : 'nízka istota';
  return `${disc}% pod mediánom (${row.marketMedianEur.toLocaleString('sk-SK')} €), kohort ${row.cohortSize} aut — ${conf}.`;
}

// The ONE definition of "effective score": persisted deal_score when present,
// otherwise a confidence/discount blend for rows the weekly cron hasn't
// recomputed yet. Used for SELECT, filtering, and ordering so the displayed
// score always matches what was filtered/sorted on.
const EFFECTIVE_SCORE = sql`COALESCE(
  fo.deal_score,
  LEAST(100, GREATEST(0,
    (fo.discount_pct * 1.5)::int
    + (CASE WHEN fo.cohort_size >= 20 THEN 25 WHEN fo.cohort_size >= 10 THEN 18 WHEN fo.cohort_size >= 5 THEN 10 ELSE 4 END)
    + (CASE fo.confidence WHEN 'high' THEN 25 WHEN 'medium' THEN 15 ELSE 5 END)
  ))
)`;

export type DealRow = {
  listing_id: string | number | bigint;
  source: string;
  url: string;
  raw_title: string | null;
  make_name: string | null;
  model_name: string | null;
  year: number | null;
  mileage_km: number | null;
  region: string | null;
  price_eur: number | null;
  market_median_eur: number;
  market_p25_eur: number;
  discount_pct: number;
  potential_gain_eur: number;
  cohort_size: number;
  confidence: 'low' | 'medium' | 'high';
  effective_score: number;
  score_breakdown: ScoreBreakdown | null;
  explainer: string | null;
  est_recond_eur: number | null;
  est_profit_eur: number | null;
  seller_type: 'private' | 'dealer' | null;
  hero_photo_url: string | null;
};

export function mapDealRow(r: DealRow): DealCard {
  return {
    listingId: BigInt(r.listing_id),
    source: r.source as Source,
    url: r.url,
    rawTitle: r.raw_title,
    makeName: r.make_name,
    modelName: r.model_name,
    year: r.year,
    mileageKm: r.mileage_km,
    region: r.region,
    priceEur: r.price_eur != null ? Math.round(r.price_eur) : null,
    heroPhotoUrl: r.hero_photo_url,
    dealScore: r.effective_score,
    scoreBreakdown: r.score_breakdown ?? null,
    marketMedianEur: Math.round(r.market_median_eur),
    marketP25Eur: Math.round(r.market_p25_eur),
    discountPct: Math.round(r.discount_pct * 10) / 10,
    potentialGainEur: Math.round(r.potential_gain_eur),
    estProfitEur:
      r.est_profit_eur ??
      fallbackProfit(Math.round(r.market_median_eur), r.price_eur, r.est_recond_eur),
    estRecondEur: r.est_recond_eur ?? 800,
    explainer:
      r.explainer ??
      buildFallbackExplainer({
        discountPct: r.discount_pct,
        marketMedianEur: Math.round(r.market_median_eur),
        cohortSize: r.cohort_size,
        confidence: r.confidence,
      }),
    cohortSize: r.cohort_size,
    confidence: r.confidence,
    sellerType: r.seller_type ?? null,
  };
}

export async function getTopDealsV2(opts: GetTopDealsOpts = {}): Promise<DealCard[]> {
  try {
    return await getTopDealsV2Unsafe(opts);
  } catch (e) {
    // Graceful-empty — this also feeds the public landing page, which must
    // render (with the empty state) even when the DB is unreachable.
    Sentry.captureException(e, { tags: { component: 'deals', step: 'getTopDealsV2' } });
    return [];
  }
}

async function getTopDealsV2Unsafe(opts: GetTopDealsOpts): Promise<DealCard[]> {
  const limit = Math.min(100, Math.max(1, opts.limit ?? 50));
  const minScore = opts.minScore != null ? Math.max(0, Math.min(100, opts.minScore)) : 0;
  const db = getDb();

  // Region filter: kraj names -> OR'd ILIKE patterns. Built as a single SQL
  // fragment so the WHERE clause stays composable.
  const regionPatterns: string[] = (opts.regions ?? [])
    .map((n) => krajByName(n))
    .filter((k): k is (typeof SK_KRAJE)[number] => Boolean(k))
    .flatMap((k) => k.patterns);

  const sourcesFilter =
    opts.sources && opts.sources.length > 0
      ? sql`AND l.source = ANY(${opts.sources}::text[]::source)`
      : sql``;

  const regionFilter =
    regionPatterns.length > 0
      ? sql`AND (${sql.join(
          regionPatterns.map((p) => sql`l.region ILIKE ${p}`),
          sql` OR `,
        )})`
      : sql``;

  const budgetFilter =
    opts.maxBudget != null && opts.maxBudget > 0
      ? sql`AND l.price_eur <= ${opts.maxBudget}`
      : sql``;

  const scoreFilter = minScore > 0 ? sql`AND ${EFFECTIVE_SCORE} >= ${minScore}` : sql``;

  const enrichedFilter = opts.enrichedOnly ? sql`AND fo.deal_score IS NOT NULL` : sql``;

  const rows = (await db.execute(sql`
    SELECT
      fo.listing_id,
      l.source::text AS source,
      l.url,
      l.raw_title,
      vmk.name AS make_name,
      vm.name AS model_name,
      l.year,
      l.mileage_km,
      l.region,
      l.price_eur::float8 AS price_eur,
      fo.market_median_eur::float8 AS market_median_eur,
      fo.market_p25_eur::float8 AS market_p25_eur,
      fo.discount_pct::float8 AS discount_pct,
      fo.potential_gain_eur::float8 AS potential_gain_eur,
      fo.cohort_size,
      fo.confidence,
      ${EFFECTIVE_SCORE} AS effective_score,
      fo.score_breakdown,
      fo.explainer,
      fo.est_recond_eur,
      fo.est_profit_eur,
      ld.seller_type,
      (
        SELECT url FROM listing_photos WHERE listing_id = l.id ORDER BY position ASC LIMIT 1
      ) AS hero_photo_url
    FROM flip_opportunities fo
    JOIN listings l ON l.id = fo.listing_id
    LEFT JOIN vehicle_models vm ON vm.id = l.model_id
    LEFT JOIN vehicle_makes vmk ON vmk.id = vm.make_id
    LEFT JOIN listing_details ld ON ld.listing_id = l.id
    WHERE l.sold_at IS NULL
      AND l.removed_at IS NULL
      AND l.canonical_listing_id IS NULL
      ${enrichedFilter}
      ${sourcesFilter}
      ${regionFilter}
      ${budgetFilter}
      ${scoreFilter}
    ORDER BY ${EFFECTIVE_SCORE} DESC, fo.discount_pct DESC
    LIMIT ${limit}
  `)) as unknown as DealRow[];

  return rows.map(mapDealRow);
}

/**
 * Top-N featured deals for the public landing page. Only returns enriched
 * rows (deal_score IS NOT NULL) — landing surface stays clean before the
 * weekly enrichment has run. Ordered by deal_score DESC.
 */
export async function getTopFeaturedDeals(limit: number): Promise<DealCard[]> {
  return getTopDealsV2({ limit: Math.max(1, Math.min(20, limit)), enrichedOnly: true });
}
