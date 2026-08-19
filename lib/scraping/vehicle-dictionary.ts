// Canonical vehicle identity: what counts as a brand, and which models belong
// to it.
//
// Why this exists: parseMakeModel used to take the first two words of a title,
// which is fine on a car marketplace and useless on a free classifieds board.
// "Predám Škoda Octavia" produced the make `predam`, and ensureModelId happily
// created a catalog row for it — 1 866 junk makes and 6 777 junk models before
// anyone noticed. Worse, "VW Golf" and "Volkswagen Golf" became two different
// models, splitting a cohort in half and skewing the median every DealScore is
// computed against.
//
// The dictionary is derived from BRAND_MODEL_BUCKETS, which was generated from
// autobazar.eu's own brand/model aggregations (104 brands, 743 pairs) — real
// data, not a hand-written list that would rot.

import { BRAND_MODEL_BUCKETS } from './sources/autobazar-eu';

/** Spellings sellers actually type, mapped to the canonical brand slug. */
const BRAND_ALIASES: Record<string, string> = {
  vw: 'volkswagen',
  mercedes: 'mercedes-benz',
  merc: 'mercedes-benz',
  benz: 'mercedes-benz',
  alfa: 'alfa-romeo',
  land: 'land-rover',
  range: 'land-rover',
  'range-rover': 'land-rover',
  rolls: 'rolls-royce',
  aston: 'aston-martin',
  chevy: 'chevrolet',
  vauxhall: 'opel',
};

type Dict = {
  brands: ReadonlySet<string>;
  modelsByBrand: ReadonlyMap<string, ReadonlySet<string>>;
};

let cached: Dict | null = null;

/**
 * Built on first use rather than at module load. normalize.ts imports this
 * module and sources/autobazar-eu.ts imports normalize.ts back, so a top-level
 * build would depend on module initialisation order. By the time anything calls
 * parseMakeModel every module is initialised.
 */
function dict(): Dict {
  if (cached) return cached;
  const brands = new Set<string>();
  const modelsByBrand = new Map<string, Set<string>>();
  for (const { brand, model } of BRAND_MODEL_BUCKETS) {
    brands.add(brand);
    if (!modelsByBrand.has(brand)) modelsByBrand.set(brand, new Set());
    if (model) modelsByBrand.get(brand)!.add(model);
  }
  cached = { brands, modelsByBrand };
  return cached;
}

/** Canonical brand slug for a token, or null when it isn't a brand at all. */
export function resolveBrand(token: string | null | undefined): string | null {
  if (!token) return null;
  const t = token.toLowerCase();
  const aliased = BRAND_ALIASES[t] ?? t;
  return dict().brands.has(aliased) ? aliased : null;
}

/** Known model slugs for a canonical brand. Empty when the brand has none. */
export function modelsFor(brand: string): ReadonlySet<string> {
  return dict().modelsByBrand.get(brand) ?? new Set<string>();
}

/** True when `model` is a known model of `brand`. */
export function isKnownModel(brand: string, model: string): boolean {
  return modelsFor(brand).has(model);
}
