import { describe, expect, it } from 'vitest';
import { estimateProfit } from '@/lib/analytics/deal-score';
import {
  buildFallbackExplainer,
  fallbackProfit,
  mapDealRow,
  normalizeBreakdown,
  type DealRow,
} from '../deals';

function baseRow(overrides: Partial<DealRow> = {}): DealRow {
  return {
    listing_id: '42',
    source: 'bazos.sk',
    url: 'https://auto.bazos.sk/inzerat/42',
    raw_title: 'Škoda Octavia 2.0 TDI',
    make_name: 'Škoda',
    model_name: 'Octavia',
    year: 2019,
    mileage_km: 120_000,
    region: 'Bratislava',
    price_eur: 10_000,
    market_median_eur: 13_000,
    market_p25_eur: 11_500,
    discount_pct: 23.1,
    potential_gain_eur: 3_000,
    cohort_size: 12,
    confidence: 'medium',
    effective_score: 74,
    score_breakdown: { discount: 0.6, cohort: 0.5, seller: 1, photo: 0.8, recency: 1 },
    explainer: 'Persistovaný explainer.',
    est_recond_eur: 800,
    est_profit_eur: 1_550,
    seller_type: 'private',
    hero_photo_url: null,
    ...overrides,
  };
}

describe('mapDealRow', () => {
  it('passes through the effective score and persisted fields', () => {
    const card = mapDealRow(baseRow());
    expect(card.listingId).toBe(BigInt(42));
    expect(card.dealScore).toBe(74);
    expect(card.estProfitEur).toBe(1_550);
    expect(card.explainer).toBe('Persistovaný explainer.');
    expect(card.marketMedianEur).toBe(13_000);
    expect(card.discountPct).toBe(23.1);
  });

  it('falls back to estimateProfit (incl. 5% fee) when est_profit_eur is NULL', () => {
    const card = mapDealRow(baseRow({ est_profit_eur: null }));
    // Must match the weekly cron's formula exactly — one source of truth.
    expect(card.estProfitEur).toBe(estimateProfit(10_000, 13_000, 800));
  });

  it('builds a Slovak fallback explainer when explainer is NULL', () => {
    const card = mapDealRow(baseRow({ explainer: null }));
    expect(card.explainer).toContain('pod mediánom');
    expect(card.explainer).toContain('stredná istota');
  });

  it('handles bigint listing ids beyond Number.MAX_SAFE_INTEGER without precision loss', () => {
    const big = '9007199254740993'; // MAX_SAFE_INTEGER + 2
    const card = mapDealRow(baseRow({ listing_id: big }));
    expect(card.listingId).toBe(BigInt(big));
  });
});

describe('fallbackProfit', () => {
  it('delegates to estimateProfit with 800 € recond default', () => {
    expect(fallbackProfit(13_000, 10_000, null)).toBe(estimateProfit(10_000, 13_000, 800));
  });

  it('can be negative for thin deals — no artificial floor at 0', () => {
    expect(fallbackProfit(10_500, 10_000, null)).toBeLessThan(0);
  });
});

describe('buildFallbackExplainer', () => {
  it('rounds the discount and names the confidence tier', () => {
    const text = buildFallbackExplainer({
      discountPct: 17.6,
      marketMedianEur: 12_000,
      cohortSize: 25,
      confidence: 'high',
    });
    expect(text).toContain('18% pod mediánom');
    expect(text).toContain('kohort 25 aut');
    expect(text).toContain('vysoká istota');
  });
});

describe('normalizeBreakdown', () => {
  it('fills missing or malformed keys with zeros', () => {
    expect(normalizeBreakdown(null)).toEqual({
      discount: 0,
      cohort: 0,
      seller: 0,
      photo: 0,
      recency: 0,
    });
    expect(normalizeBreakdown({ discount: 0.4, seller: 'oops' })).toEqual({
      discount: 0.4,
      cohort: 0,
      seller: 0,
      photo: 0,
      recency: 0,
    });
  });
});
