import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PLANS, planAtLeast, planFromStripePriceId, quotasFor } from '../plans';

describe('planAtLeast', () => {
  it('orders plans free < plus < premium', () => {
    expect(planAtLeast('free', 'free')).toBe(true);
    expect(planAtLeast('plus', 'free')).toBe(true);
    expect(planAtLeast('premium', 'plus')).toBe(true);
    expect(planAtLeast('free', 'plus')).toBe(false);
    expect(planAtLeast('plus', 'premium')).toBe(false);
  });
});

describe('planFromStripePriceId', () => {
  beforeEach(() => {
    // Re-evaluate the lazy mapping at the price-id callsite by stubbing PLANS.
    PLANS.plus.stripePriceMonthly = 'price_plus_m';
    PLANS.plus.stripePriceYearly = 'price_plus_y';
    PLANS.premium.stripePriceMonthly = 'price_prem_m';
    PLANS.premium.stripePriceYearly = 'price_prem_y';
  });
  afterEach(() => {
    PLANS.plus.stripePriceMonthly = process.env.STRIPE_PRICE_PLUS_MONTHLY ?? null;
    PLANS.plus.stripePriceYearly = process.env.STRIPE_PRICE_PLUS_YEARLY ?? null;
    PLANS.premium.stripePriceMonthly = process.env.STRIPE_PRICE_PREMIUM_MONTHLY ?? null;
    PLANS.premium.stripePriceYearly = process.env.STRIPE_PRICE_PREMIUM_YEARLY ?? null;
  });

  it('matches monthly and yearly price ids to plans', () => {
    expect(planFromStripePriceId('price_plus_m')).toBe('plus');
    expect(planFromStripePriceId('price_plus_y')).toBe('plus');
    expect(planFromStripePriceId('price_prem_m')).toBe('premium');
    expect(planFromStripePriceId('price_prem_y')).toBe('premium');
  });

  it('falls back to free for unknown / nullish input', () => {
    expect(planFromStripePriceId(null)).toBe('free');
    expect(planFromStripePriceId('')).toBe('free');
    expect(planFromStripePriceId('price_unknown')).toBe('free');
  });
});

describe('quotasFor', () => {
  it('returns the canonical quotas per plan', () => {
    expect(quotasFor('free').aiListingsPerMonth).toBe(3);
    expect(quotasFor('plus').aiListingsPerMonth).toBe(50);
    expect(quotasFor('premium').aiListingsPerMonth).toBe(-1);
    expect(quotasFor('premium').apiAccess).toBe(true);
    expect(quotasFor('plus').apiAccess).toBe(false);
  });
});
