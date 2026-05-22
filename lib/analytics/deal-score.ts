// Pure functions for the DealScore 0-100 algorithm and supporting
// explainer/profit estimation. No DB dependency — callers wire up the
// inputs from listings/cohort queries.

export type DealScoreInput = {
  priceEur: number;
  cohortMedianEur: number;
  cohortSize: number;
  sellerType: 'private' | 'dealer' | null;
  photoCount: number;
  daysSinceFirstSeen: number;
};

export type DealScoreBreakdown = {
  discount: number;
  cohort: number;
  seller: number;
  photo: number;
  recency: number;
};

export type DealScoreOutput = {
  score: number;
  breakdown: DealScoreBreakdown;
  discountPct: number;
};

const DISCOUNT_CAP = 0.4;
const COHORT_TARGET = 50;
const RECENCY_FULL_DAYS = 14;
const RECENCY_ZERO_DAYS = 60;

export function computeDealScore(input: DealScoreInput): DealScoreOutput {
  const safeMedian = input.cohortMedianEur > 0 ? input.cohortMedianEur : 0;
  const safePrice = input.priceEur > 0 ? input.priceEur : 0;

  const discountPct = safeMedian > 0 ? Math.max(0, (safeMedian - safePrice) / safeMedian) : 0;
  const discount = Math.min(1, discountPct / DISCOUNT_CAP);

  const cohort = Math.min(
    1,
    Math.sqrt(Math.max(0, input.cohortSize)) / Math.sqrt(COHORT_TARGET),
  );

  const seller =
    input.sellerType === 'private' ? 1.0 : input.sellerType === 'dealer' ? 0.5 : 0.6;

  const photo = Math.min(1, Math.max(0, input.photoCount) / 10);

  const days = Math.max(0, input.daysSinceFirstSeen);
  const recency =
    days <= RECENCY_FULL_DAYS
      ? 1.0
      : days >= RECENCY_ZERO_DAYS
        ? 0
        : 1 - (days - RECENCY_FULL_DAYS) / (RECENCY_ZERO_DAYS - RECENCY_FULL_DAYS);

  const score = Math.round(
    100 * (0.5 * discount + 0.2 * cohort + 0.1 * seller + 0.1 * photo + 0.1 * recency),
  );

  return {
    score,
    breakdown: { discount, cohort, seller, photo, recency },
    discountPct,
  };
}

export function buildExplainer(
  input: DealScoreInput,
  makeName: string,
  modelName: string,
  year: number | null,
  region: string | null,
): string {
  const pct =
    input.priceEur > 0 && input.cohortMedianEur > 0
      ? Math.round(((input.cohortMedianEur - input.priceEur) / input.cohortMedianEur) * 100)
      : 0;
  const car = [year, makeName, modelName].filter(Boolean).join(' ');
  const sellerLabel =
    input.sellerType === 'private'
      ? 'Súkromný predajca'
      : input.sellerType === 'dealer'
        ? 'Predajca'
        : 'Predajca neznámy';
  const regionTxt = region ? ` v regióne ${region}` : '';
  return `${pct}% pod mediánom ${car}${regionTxt} (cohort n=${input.cohortSize}). ${sellerLabel}. Inzerát vystavený pred ${Math.round(input.daysSinceFirstSeen)} dňami.`;
}

export function estimateProfit(
  priceEur: number,
  cohortMedianEur: number,
  estRecondEur: number = 800,
): number {
  const sellPrice = cohortMedianEur;
  const buyPrice = priceEur;
  const transactionFees = Math.round(sellPrice * 0.05);
  return Math.round(sellPrice - buyPrice - estRecondEur - transactionFees);
}
