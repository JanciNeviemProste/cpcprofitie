import { quotasFor, type PlanId } from './plans';

export type QuotaCheck =
  | { ok: true; remaining: number | 'unlimited' }
  | { ok: false; reason: 'plan_limit'; limit: number };

function check(used: number, limit: number): QuotaCheck {
  if (limit < 0) return { ok: true, remaining: 'unlimited' };
  if (used >= limit) return { ok: false, reason: 'plan_limit', limit };
  return { ok: true, remaining: limit - used };
}

export function canGenerateAiListing(plan: PlanId, usedThisMonth: number): QuotaCheck {
  return check(usedThisMonth, quotasFor(plan).aiListingsPerMonth);
}

export function canCreateWatchlist(plan: PlanId, currentCount: number): QuotaCheck {
  return check(currentCount, quotasFor(plan).watchlistEntries);
}

export function canAddGarageEntry(plan: PlanId, currentCount: number): QuotaCheck {
  return check(currentCount, quotasFor(plan).garageEntries);
}

export function canRunAnalysis(plan: PlanId, usedThisMonth: number): QuotaCheck {
  return check(usedThisMonth, quotasFor(plan).analysesPerMonth);
}
