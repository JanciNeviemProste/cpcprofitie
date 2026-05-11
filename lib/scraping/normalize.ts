import type { RawFuel, RawTransmission } from './types';

const FUEL_MAP: Record<string, RawFuel> = {
  // SK
  benzín: 'gasoline',
  nafta: 'diesel',
  hybrid: 'hybrid',
  'plug-in hybrid': 'phev',
  phev: 'phev',
  elektro: 'electric',
  elektrické: 'electric',
  // CZ
  benzin: 'gasoline',
  diesel: 'diesel',
  elektrický: 'electric',
  hybridní: 'hybrid',
  // Universal
  lpg: 'lpg',
  cng: 'cng',
};

const TRANSMISSION_MAP: Record<string, RawTransmission> = {
  // SK
  manuálna: 'manual',
  manual: 'manual',
  automat: 'automatic',
  automatická: 'automatic',
  // CZ
  manuální: 'manual',
  automatická_cz: 'automatic',
  // Both: 'automatická' covered above
};

export function parseFuel(raw: string | null | undefined): RawFuel | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  return FUEL_MAP[key] ?? null;
}

export function parseTransmission(raw: string | null | undefined): RawTransmission | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  return TRANSMISSION_MAP[key] ?? null;
}

export function parseEur(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Parse a Czech-koruna price string ("450 000 Kč") into CZK number. */
export function parseCzk(raw: string | null | undefined): number | null {
  if (!raw) return null;
  if (!/k[čc]|czk/i.test(raw)) {
    // Allow callers to pass pure-digit strings; reject if explicit currency
    // suffix points at something else (e.g. "€").
    if (/€|eur/i.test(raw)) return null;
  }
  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Cheap CZK→EUR conversion with a fixed rate. Real rate would come from an
 *  ECB feed; this is fine for "compare order of magnitude" dashboards. */
export const CZK_PER_EUR = 25;

export function czkToEur(czk: number): number {
  return Math.round(czk / CZK_PER_EUR);
}

export function parseKm(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function parseYear(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = /(\d{4})/.exec(raw);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1980 && n <= new Date().getFullYear() + 1 ? n : null;
}

export function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Heuristic make/model extraction from a free-text title like
// "Škoda Octavia 2.0 TDI Combi 2019" — replace with DB-backed canonical
// matching once vehicle_makes/vehicle_models is seeded.
export function parseMakeModel(title: string | null | undefined): {
  makeSlug: string | null;
  modelSlug: string | null;
} {
  if (!title) return { makeSlug: null, modelSlug: null };
  const tokens = title.trim().split(/\s+/);
  if (tokens.length < 2) return { makeSlug: slugify(tokens[0] ?? ''), modelSlug: null };
  const make = slugify(tokens[0]!);
  const model = slugify(tokens[1]!);
  return { makeSlug: make, modelSlug: `${make}-${model}` };
}

// ─── Free-text extractors (used by source plugins) ────────────────────────────
// Real listing pages on autobazar.sk / bazos / sauto.cz don't expose price or
// year via dedicated CSS classes — they live in mixed text content next to the
// anchor. These helpers pull the canonical value out of that text.

const WHITESPACE_RE = /\s+/g;

function squeezeDigits(s: string): string {
  return s.replace(WHITESPACE_RE, '');
}

/** Extract EUR price from arbitrary text. */
export function extractEurFromText(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = /(\d[\d\s]{1,12})\s*€/.exec(text);
  if (!m) return null;
  const n = Number(squeezeDigits(m[1]!));
  return Number.isFinite(n) && n >= 100 && n < 10_000_000 ? n : null;
}

/** Extract CZK price (sauto.cz format like "385 000 Kč"). */
export function extractCzkFromText(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = /(\d[\d\s]{1,12})\s*k[čc]/i.exec(text);
  if (!m) return null;
  const n = Number(squeezeDigits(m[1]!));
  return Number.isFinite(n) && n >= 1000 && n < 100_000_000 ? n : null;
}

/** Extract a plausible vehicle year (1980–nextYear). */
export function extractYearFromText(text: string | null | undefined): number | null {
  if (!text) return null;
  const re = /\b(19|20)\d{2}\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const n = Number(m[0]);
    if (n >= 1980 && n <= new Date().getFullYear() + 1) return n;
  }
  return null;
}

/** Extract mileage in km from text like "120 000 km". */
export function extractKmFromText(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = /(\d[\d\s]{1,8})\s*km\b/i.exec(text);
  if (!m) return null;
  const n = Number(squeezeDigits(m[1]!));
  return Number.isFinite(n) && n >= 0 && n < 2_000_000 ? n : null;
}

const FUEL_HINTS = [
  'benzín',
  'benzin',
  'nafta',
  'diesel',
  'hybridní',
  'hybrid',
  'plug-in',
  'phev',
  'elektrické',
  'elektrický',
  'elektro',
  'lpg',
  'cng',
];

const TRANSMISSION_HINTS = ['manuálna', 'manuální', 'manual', 'automatická', 'automat'];

export function extractFuelHintFromText(text: string | null | undefined): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const hint of FUEL_HINTS) {
    if (lower.includes(hint)) return hint;
  }
  return null;
}

export function extractTransmissionHintFromText(text: string | null | undefined): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const hint of TRANSMISSION_HINTS) {
    if (lower.includes(hint)) return hint;
  }
  return null;
}

/** Apply the SK-/CZ- prefix to a free-text region. No-op when already prefixed. */
export function prefixRegion(region: string | null, country: 'SK' | 'CZ'): string | null {
  if (!region) return null;
  const trimmed = region.trim();
  if (!trimmed) return null;
  if (/^(SK|CZ)-/.test(trimmed)) return trimmed;
  return `${country}-${trimmed}`;
}
