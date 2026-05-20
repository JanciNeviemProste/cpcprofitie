// Fingerprint hash for repost detection. Sellers commonly delete a listing and
// re-create it under a new sourceId so it bubbles to the top of the feed.
// Without a stable fingerprint, each repost looks like a new car and skews
// every demand metric we compute downstream.
//
// Strategy: SHA-256 over normalized identifying fields. Photo URL basename is
// a stable proxy on autobazar.eu (their CDN paths don't change when the same
// image is re-uploaded). Perceptual photo hashing is a v2 follow-up.

import { createHash } from 'node:crypto';

export type FingerprintInput = {
  makeSlug: string | null;
  modelSlug: string | null;
  year: number | null;
  mileageKm: number | null;
  region: string | null;
  sellerName: string | null;
  firstPhotoUrl: string | null;
};

/** SHA-256 hex (lowercase) over a deterministic key. Length: 64 chars. */
export function computeFingerprint(input: FingerprintInput): string {
  const key = [
    input.makeSlug ?? 'unknown',
    input.modelSlug ?? 'unknown',
    input.year ?? 'unknown',
    mileageBucket(input.mileageKm),
    normalizeRegion(input.region),
    normalizeSeller(input.sellerName),
    extractPhotoBasename(input.firstPhotoUrl),
  ].join('|');
  return createHash('sha256').update(key).digest('hex');
}

/** Floor mileage to the nearest 5 000 km. Sellers often re-list a car after
 *  a few hundred km of driving; flooring puts anything in [N×5k, (N+1)×5k)
 *  into the same bucket. */
export function mileageBucket(km: number | null | undefined): string {
  if (km == null || km < 0) return 'unknown';
  return String(Math.floor(km / 5000) * 5000);
}

const DIACRITIC_RE = /[̀-ͯ]/g;

export function normalizeSeller(name: string | null | undefined): string {
  if (!name) return 'no-seller';
  return name
    .normalize('NFD')
    .replace(DIACRITIC_RE, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'no-seller';
}

export function normalizeRegion(region: string | null | undefined): string {
  if (!region) return 'unknown-region';
  return region
    .normalize('NFD')
    .replace(DIACRITIC_RE, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Extract a stable identifier from a photo URL. The hostname and tracking
 *  query params change; the file path's basename (last segment without
 *  extension) is what survives across CDN reshuffles. */
export function extractPhotoBasename(url: string | null | undefined): string {
  if (!url) return 'no-photo';
  try {
    const u = new URL(url);
    const last = u.pathname.split('/').filter(Boolean).pop() ?? '';
    const noExt = last.replace(/\.[a-z0-9]{1,5}$/i, '');
    return noExt || 'no-photo';
  } catch {
    return 'no-photo';
  }
}

// Year-bucket and mileage-bucket helpers used by both fingerprint computation
// and market_snapshots cohort grouping. Keeping the canonical mapping here so
// both code paths agree on bucket boundaries.

export type YearBucket = '2020+' | '2015-19' | '2010-14' | '<2010' | 'unknown';

export function yearBucket(year: number | null | undefined): YearBucket {
  if (year == null) return 'unknown';
  if (year >= 2020) return '2020+';
  if (year >= 2015) return '2015-19';
  if (year >= 2010) return '2010-14';
  return '<2010';
}

export type MileageBucketLabel = '0-50k' | '50-100k' | '100-150k' | '150k+' | 'unknown';

export function mileageBucketLabel(km: number | null | undefined): MileageBucketLabel {
  if (km == null || km < 0) return 'unknown';
  if (km < 50_000) return '0-50k';
  if (km < 100_000) return '50-100k';
  if (km < 150_000) return '100-150k';
  return '150k+';
}
