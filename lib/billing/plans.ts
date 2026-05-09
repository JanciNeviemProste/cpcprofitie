// Single source of truth for billing plans. Stripe price IDs are pulled from
// env so we don't hardcode product IDs across environments. The `quotas`
// object is enforced at runtime by lib/billing/quota.ts.

export type PlanId = 'free' | 'plus' | 'premium';

export type PlanQuotas = {
  /** AI listing generations per calendar month. -1 = unlimited. */
  aiListingsPerMonth: number;
  /** Concurrent watchlist entries. -1 = unlimited. */
  watchlistEntries: number;
  /** Garage entries. -1 = unlimited. */
  garageEntries: number;
  /** Analyses per calendar month. -1 = unlimited. */
  analysesPerMonth: number;
  /** Whether real-time anomaly insights are exposed. */
  anomalyInsights: boolean;
  /** Whether the user can hit the public REST API. */
  apiAccess: boolean;
};

export type Plan = {
  id: PlanId;
  name: string;
  priceEurMonthly: number;
  priceEurYearly: number;
  stripePriceMonthly: string | null;
  stripePriceYearly: string | null;
  quotas: PlanQuotas;
};

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    priceEurMonthly: 0,
    priceEurYearly: 0,
    stripePriceMonthly: null,
    stripePriceYearly: null,
    quotas: {
      aiListingsPerMonth: 3,
      watchlistEntries: 1,
      garageEntries: 3,
      analysesPerMonth: 3,
      anomalyInsights: false,
      apiAccess: false,
    },
  },
  plus: {
    id: 'plus',
    name: 'Plus',
    priceEurMonthly: 19,
    priceEurYearly: 190,
    stripePriceMonthly: process.env.STRIPE_PRICE_PLUS_MONTHLY ?? null,
    stripePriceYearly: process.env.STRIPE_PRICE_PLUS_YEARLY ?? null,
    quotas: {
      aiListingsPerMonth: 50,
      watchlistEntries: 5,
      garageEntries: 20,
      analysesPerMonth: -1,
      anomalyInsights: false,
      apiAccess: false,
    },
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    priceEurMonthly: 49,
    priceEurYearly: 490,
    stripePriceMonthly: process.env.STRIPE_PRICE_PREMIUM_MONTHLY ?? null,
    stripePriceYearly: process.env.STRIPE_PRICE_PREMIUM_YEARLY ?? null,
    quotas: {
      aiListingsPerMonth: -1,
      watchlistEntries: -1,
      garageEntries: -1,
      analysesPerMonth: -1,
      anomalyInsights: true,
      apiAccess: true,
    },
  },
};

const PLAN_RANK: Record<PlanId, number> = { free: 0, plus: 1, premium: 2 };

export function planAtLeast(actual: PlanId, required: PlanId): boolean {
  return PLAN_RANK[actual] >= PLAN_RANK[required];
}

export function planFromStripePriceId(priceId: string | null | undefined): PlanId {
  if (!priceId) return 'free';
  for (const plan of Object.values(PLANS)) {
    if (plan.stripePriceMonthly === priceId || plan.stripePriceYearly === priceId) {
      return plan.id;
    }
  }
  return 'free';
}

export function quotasFor(plan: PlanId): PlanQuotas {
  return PLANS[plan].quotas;
}
