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
