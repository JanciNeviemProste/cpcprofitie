// Deterministic mock data so dashboards render identically across reloads
// until the scraper backfill replaces them.

export type MockModel = {
  slug: string;
  make: string;
  name: string;
  bodyType: 'sedan' | 'hatchback' | 'wagon' | 'suv' | 'coupe';
  imageUrl?: string;
};

export const mockModels: MockModel[] = [
  { slug: 'skoda-octavia', make: 'Škoda', name: 'Octavia', bodyType: 'wagon' },
  { slug: 'volkswagen-passat', make: 'Volkswagen', name: 'Passat', bodyType: 'wagon' },
  { slug: 'bmw-3-320d', make: 'BMW', name: '3 Series 320d', bodyType: 'sedan' },
  { slug: 'audi-a4', make: 'Audi', name: 'A4', bodyType: 'sedan' },
  { slug: 'mercedes-c220d', make: 'Mercedes-Benz', name: 'C 220d', bodyType: 'sedan' },
  { slug: 'volkswagen-golf', make: 'Volkswagen', name: 'Golf', bodyType: 'hatchback' },
  { slug: 'skoda-superb', make: 'Škoda', name: 'Superb', bodyType: 'wagon' },
  { slug: 'kia-sportage', make: 'Kia', name: 'Sportage', bodyType: 'suv' },
  { slug: 'hyundai-tucson', make: 'Hyundai', name: 'Tucson', bodyType: 'suv' },
  { slug: 'ford-focus', make: 'Ford', name: 'Focus', bodyType: 'hatchback' },
];

export function findModel(slug: string) {
  return mockModels.find((m) => m.slug === slug);
}

export const slovakRegions = [
  'Bratislavský',
  'Trnavský',
  'Trenčiansky',
  'Nitriansky',
  'Žilinský',
  'Banskobystrický',
  'Prešovský',
  'Košický',
];

// Pseudo-random but deterministic per seed — so the SSR'd HTML matches client rehydration.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export type MarketKpi = {
  modelSlug: string;
  basePrice: number;
  median: number;
  p25: number;
  p75: number;
  countActive: number;
  countSoldLast30d: number;
  daysToSellAvg: number;
  weeklyChangePct: number;
};

export function mockMarketKpi(modelSlug: string): MarketKpi {
  const rng = mulberry32(hashSeed(modelSlug));
  const basePrice = 8000 + Math.floor(rng() * 30000);
  const spread = 0.18 + rng() * 0.12;
  return {
    modelSlug,
    basePrice,
    median: basePrice,
    p25: Math.round(basePrice * (1 - spread)),
    p75: Math.round(basePrice * (1 + spread)),
    countActive: 60 + Math.floor(rng() * 600),
    countSoldLast30d: 20 + Math.floor(rng() * 200),
    daysToSellAvg: 8 + Math.floor(rng() * 40),
    weeklyChangePct: -3 + rng() * 6,
  };
}

export type TimePoint = { date: string; median: number; p25: number; p75: number };

// Anchor mock dates to a fixed Monday so SSR and CSR render the same labels.
// Real market_snapshots will replace this once the scraper backfills.
const MOCK_ANCHOR = new Date('2026-05-04T00:00:00Z');

export function mockTimeSeries(modelSlug: string, weeks = 26): TimePoint[] {
  const rng = mulberry32(hashSeed(modelSlug + ':ts'));
  const kpi = mockMarketKpi(modelSlug);
  const points: TimePoint[] = [];
  let median = kpi.median * 1.05;
  for (let i = weeks - 1; i >= 0; i--) {
    const drift = (rng() - 0.5) * 200;
    median = median + drift - 8;
    const spread = median * 0.18;
    const date = new Date(MOCK_ANCHOR);
    date.setUTCDate(MOCK_ANCHOR.getUTCDate() - i * 7);
    points.push({
      date: date.toISOString().slice(0, 10),
      median: Math.round(median),
      p25: Math.round(median - spread),
      p75: Math.round(median + spread),
    });
  }
  return points;
}

export type DistributionBucket = { bucket: string; count: number; lower: number };

export function mockDistribution(modelSlug: string, bins = 12): DistributionBucket[] {
  const rng = mulberry32(hashSeed(modelSlug + ':dist'));
  const kpi = mockMarketKpi(modelSlug);
  const min = kpi.p25 * 0.7;
  const max = kpi.p75 * 1.4;
  const step = (max - min) / bins;
  return Array.from({ length: bins }, (_, i) => {
    const center = min + step * (i + 0.5);
    const distance = Math.abs(center - kpi.median) / kpi.median;
    const peak = Math.exp(-distance * distance * 6);
    const noise = 0.6 + rng() * 0.6;
    return {
      bucket: `${Math.round((min + step * i) / 1000)}k`,
      lower: Math.round(min + step * i),
      count: Math.max(1, Math.round(peak * 80 * noise)),
    };
  });
}

export type SimilarListing = {
  id: string;
  modelName: string;
  year: number;
  mileageKm: number;
  priceEur: number;
  region: string;
  source: 'autobazar.sk' | 'mobile.de' | 'autoscout24';
  daysListed: number;
};

export function mockListings(modelSlug: string, count = 8): SimilarListing[] {
  const rng = mulberry32(hashSeed(modelSlug + ':listings'));
  const model = findModel(modelSlug);
  const kpi = mockMarketKpi(modelSlug);
  const sources: SimilarListing['source'][] = ['autobazar.sk', 'mobile.de', 'autoscout24'];
  return Array.from({ length: count }, (_, i) => ({
    id: `${modelSlug}-${i}`,
    modelName: model ? `${model.make} ${model.name}` : modelSlug,
    year: 2018 + Math.floor(rng() * 7),
    mileageKm: 30000 + Math.floor(rng() * 180000),
    priceEur: Math.round(kpi.p25 + rng() * (kpi.p75 - kpi.p25) * 1.4),
    region: slovakRegions[Math.floor(rng() * slovakRegions.length)] ?? 'Bratislavský',
    source: sources[Math.floor(rng() * sources.length)] ?? 'autobazar.sk',
    daysListed: Math.floor(rng() * 60),
  }));
}

export type TrendingItem = {
  modelSlug: string;
  modelName: string;
  changePct: number;
  countActive: number;
  median: number;
};

export function mockTrending(): TrendingItem[] {
  return mockModels.map((m) => {
    const kpi = mockMarketKpi(m.slug);
    return {
      modelSlug: m.slug,
      modelName: `${m.make} ${m.name}`,
      changePct: kpi.weeklyChangePct,
      countActive: kpi.countActive,
      median: kpi.median,
    };
  });
}

export type GarageCar = {
  id: string;
  modelSlug: string;
  modelName: string;
  year: number;
  mileageKm: number;
  purchasePriceEur: number;
  targetMarginEur: number;
  marketMedianEur: number;
};

export function mockGarage(): GarageCar[] {
  const slugs = ['skoda-octavia', 'volkswagen-passat', 'bmw-3-320d'];
  return slugs.map((slug, i) => {
    const m = findModel(slug)!;
    const kpi = mockMarketKpi(slug);
    return {
      id: `mock-garage-${i}`,
      modelSlug: slug,
      modelName: `${m.make} ${m.name}`,
      year: 2019 + i,
      mileageKm: 80000 + i * 15000,
      purchasePriceEur: Math.round(kpi.median * 0.78),
      targetMarginEur: 1500 + i * 250,
      marketMedianEur: kpi.median,
    };
  });
}

export type WatchlistEntry = {
  id: string;
  modelSlug: string;
  modelName: string;
  region: string;
  maxPriceEur: number;
  minYear: number;
  matchesLast7d: number;
};

export function mockWatchlist(): WatchlistEntry[] {
  const seeds = [
    { slug: 'audi-a4', region: 'Bratislavský', max: 18000, year: 2018 },
    { slug: 'kia-sportage', region: 'Žilinský', max: 22000, year: 2020 },
  ];
  return seeds.map((s, i) => {
    const m = findModel(s.slug)!;
    const kpi = mockMarketKpi(s.slug);
    return {
      id: `mock-watch-${i}`,
      modelSlug: s.slug,
      modelName: `${m.make} ${m.name}`,
      region: s.region,
      maxPriceEur: s.max,
      minYear: s.year,
      matchesLast7d: Math.max(0, kpi.countActive - 200) % 12,
    };
  });
}
