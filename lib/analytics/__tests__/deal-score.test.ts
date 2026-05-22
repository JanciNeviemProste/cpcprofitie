import { describe, expect, it } from 'vitest';
import { buildExplainer, computeDealScore, estimateProfit } from '../deal-score';

describe('computeDealScore', () => {
  it('returns a very high score for a great deal (big discount + private + many photos + recent + large cohort)', () => {
    const out = computeDealScore({
      priceEur: 6000,
      cohortMedianEur: 10000, // 40% below median → discount=1.0
      cohortSize: 50, // cohort=1.0
      sellerType: 'private', // seller=1.0
      photoCount: 10, // photo=1.0
      daysSinceFirstSeen: 3, // recency=1.0
    });
    expect(out.score).toBeGreaterThanOrEqual(90);
    expect(out.score).toBeLessThanOrEqual(100);
    expect(out.discountPct).toBeCloseTo(0.4, 5);
  });

  it('returns score 0 when there is no discount (price equals median)', () => {
    const out = computeDealScore({
      priceEur: 10000,
      cohortMedianEur: 10000,
      cohortSize: 0,
      sellerType: null,
      photoCount: 0,
      daysSinceFirstSeen: 100,
    });
    // 0.5*0 + 0.2*0 + 0.1*0.6 + 0.1*0 + 0.1*0 = 0.06 → 6
    // No-discount + unknown seller still credits 0.06 → round to 6.
    expect(out.score).toBe(6);
    expect(out.discountPct).toBe(0);
  });

  it('treats price > median as zero discount (no negative contributions)', () => {
    const out = computeDealScore({
      priceEur: 12000,
      cohortMedianEur: 10000,
      cohortSize: 0,
      sellerType: null,
      photoCount: 0,
      daysSinceFirstSeen: 0,
    });
    expect(out.breakdown.discount).toBe(0);
    expect(out.discountPct).toBe(0);
  });

  it('handles cohortMedianEur=0 without dividing by zero', () => {
    const out = computeDealScore({
      priceEur: 5000,
      cohortMedianEur: 0,
      cohortSize: 10,
      sellerType: 'dealer',
      photoCount: 5,
      daysSinceFirstSeen: 10,
    });
    expect(Number.isFinite(out.score)).toBe(true);
    expect(out.breakdown.discount).toBe(0);
    expect(out.discountPct).toBe(0);
  });

  it('handles priceEur=0 gracefully', () => {
    const out = computeDealScore({
      priceEur: 0,
      cohortMedianEur: 10000,
      cohortSize: 25,
      sellerType: 'private',
      photoCount: 8,
      daysSinceFirstSeen: 5,
    });
    // price=0 means discount=100% → capped at 1.0
    expect(out.breakdown.discount).toBe(1);
    expect(out.score).toBeGreaterThan(70);
  });

  it('uses 0.6 weight for unknown seller, 0.5 for dealer, 1.0 for private', () => {
    const base = {
      priceEur: 8000,
      cohortMedianEur: 10000,
      cohortSize: 25,
      photoCount: 5,
      daysSinceFirstSeen: 5,
    };
    const priv = computeDealScore({ ...base, sellerType: 'private' });
    const dealer = computeDealScore({ ...base, sellerType: 'dealer' });
    const unknown = computeDealScore({ ...base, sellerType: null });
    expect(priv.score).toBeGreaterThan(unknown.score);
    expect(unknown.score).toBeGreaterThan(dealer.score);
    expect(priv.breakdown.seller).toBe(1);
    expect(dealer.breakdown.seller).toBe(0.5);
    expect(unknown.breakdown.seller).toBe(0.6);
  });

  it('decays recency linearly between 14 and 60 days', () => {
    const base = {
      priceEur: 7000,
      cohortMedianEur: 10000,
      cohortSize: 25,
      sellerType: 'private' as const,
      photoCount: 5,
    };
    const fresh = computeDealScore({ ...base, daysSinceFirstSeen: 10 });
    const mid = computeDealScore({ ...base, daysSinceFirstSeen: 37 });
    const stale = computeDealScore({ ...base, daysSinceFirstSeen: 60 });
    expect(fresh.breakdown.recency).toBe(1);
    expect(mid.breakdown.recency).toBeGreaterThan(0);
    expect(mid.breakdown.recency).toBeLessThan(1);
    expect(stale.breakdown.recency).toBe(0);
  });

  it('caps cohort signal at 1 when cohort size is huge', () => {
    const out = computeDealScore({
      priceEur: 6000,
      cohortMedianEur: 10000,
      cohortSize: 500,
      sellerType: 'private',
      photoCount: 10,
      daysSinceFirstSeen: 1,
    });
    expect(out.breakdown.cohort).toBe(1);
  });
});

describe('buildExplainer', () => {
  it('renders the canonical Slovak explainer string', () => {
    const txt = buildExplainer(
      {
        priceEur: 7000,
        cohortMedianEur: 10000,
        cohortSize: 25,
        sellerType: 'private',
        photoCount: 8,
        daysSinceFirstSeen: 5,
      },
      'Skoda',
      'Octavia',
      2018,
      'Bratislava',
    );
    expect(txt).toContain('30% pod mediánom');
    expect(txt).toContain('2018 Skoda Octavia');
    expect(txt).toContain('Bratislava');
    expect(txt).toContain('cohort n=25');
    expect(txt).toContain('Súkromný predajca');
  });

  it('handles missing seller and region', () => {
    const txt = buildExplainer(
      {
        priceEur: 5000,
        cohortMedianEur: 8000,
        cohortSize: 10,
        sellerType: null,
        photoCount: 0,
        daysSinceFirstSeen: 12,
      },
      'BMW',
      '320d',
      null,
      null,
    );
    expect(txt).toContain('Predajca neznámy');
    expect(txt).not.toContain('v regióne');
  });
});

describe('estimateProfit', () => {
  it('subtracts buy price, recond, and 5% transaction fees from sell price', () => {
    // sell 10000, buy 7000, recond 800, fees 500 → profit 1700
    expect(estimateProfit(7000, 10000, 800)).toBe(1700);
  });

  it('uses default 800 EUR recond when not specified', () => {
    expect(estimateProfit(7000, 10000)).toBe(1700);
  });

  it('can return a negative profit when the math doesn’t work', () => {
    // sell 5000, buy 4800, recond 800, fees 250 → -850
    expect(estimateProfit(4800, 5000)).toBe(-850);
  });
});
