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
  /** Which site this listing came from. Decides whether its photo URLs carry
   *  any information about the car as opposed to about the advert. */
  source: string;
  /** The site's own id for this advert — used to detect a photo URL that is
   *  merely the advert id wearing a different hat. */
  sourceId: string;
  makeSlug: string | null;
  modelSlug: string | null;
  year: number | null;
  mileageKm: number | null;
  region: string | null;
  sellerName: string | null;
  firstPhotoUrl: string | null;
};

/**
 * A per-car identifier, or null when this listing carries nothing that could
 * identify the car across two adverts.
 *
 * Returning null matters more than it looks. Every null field in the key below
 * collapses to a constant sentinel, so a listing that knows nothing about
 * itself hashes to a value it shares with every other such listing — and the
 * clustering pass then merges them as reposts of one car. That is not a
 * theoretical risk: it put 681 Škoda Octavias, 2001 to 2024, EUR 2 499 to
 * EUR 22 999, with different VINs, into a single "duplicate" group, and hid
 * 13 631 bazoš listings (68% of the source) from the market.
 *
 * A hash computed from no identity is not an identity. Say so, rather than
 * handing back a number that looks like one.
 */
export function computeFingerprint(input: FingerprintInput): string | null {
  const photo = photoIdentity(input.source, input.firstPhotoUrl, input.sourceId);
  if (!hasDiscriminator({ ...input, photo })) return null;

  const key = [
    input.makeSlug ?? 'unknown',
    input.modelSlug ?? 'unknown',
    input.year ?? 'unknown',
    mileageBucket(input.mileageKm),
    normalizeRegion(input.region),
    normalizeSeller(input.sellerName),
    photo ?? 'no-photo',
  ].join('|');
  return createHash('sha256').update(key).digest('hex');
}

/**
 * True when the listing carries at least one thing that distinguishes this car
 * from another car of the same make and model.
 *
 * Make and model alone are never enough — "a Škoda Octavia" describes thousands
 * of separate cars. Region is not enough either; it is a county. What counts is
 * a photo that belongs to the car, a named seller, or a year together with a
 * mileage, which as a pair are specific enough to be worth a guess.
 *
 * Exported so that the write paths can apply the same test as the reader. When
 * persist.ts and the refresh disagree about what deserves a fingerprint, one
 * writes NULL and the other writes it back, forever.
 */
export function hasDiscriminator(input: {
  year: number | null;
  mileageKm: number | null;
  sellerName: string | null;
  photo: string | null;
}): boolean {
  if (input.photo) return true;
  if (input.sellerName && input.sellerName.trim().length > 0) return true;
  return input.year != null && input.mileageKm != null && input.mileageKm >= 0;
}

/**
 * The photo's contribution to a car's identity, or null when it has none.
 *
 * On bazoš every image path is built from the advert id — advert 194731342 is
 * pictured at /img/1t/342/194731342.jpg — so the basename is the advert id
 * restated. 19 940 of 20 133 bazoš listings are like this; on both autobazars,
 * zero are.
 *
 * Feeding that into the fingerprint would be worse than useless. It would make
 * the fingerprint a bijection with the advert id, so no repost could ever match
 * its original — and, far worse, sold-detector treats "no other listing shares
 * this fingerprint" as proof of sale, which would then be true of every removed
 * bazoš advert. It would have marked the whole source sold, irreversibly.
 */
export function photoIdentity(
  source: string,
  url: string | null | undefined,
  sourceId: string | null | undefined,
): string | null {
  const basename = extractPhotoBasename(url);
  if (basename === 'no-photo') return null;
  // Checked against the id rather than against a list of sources: a site that
  // changes its URL scheme should not need this file edited to stay correct.
  if (sourceId && basename.includes(sourceId)) return null;
  return `${source}:${basename}`;
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
