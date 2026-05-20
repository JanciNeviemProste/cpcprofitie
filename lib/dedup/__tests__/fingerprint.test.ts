import { describe, expect, it } from 'vitest';
import {
  computeFingerprint,
  extractPhotoBasename,
  mileageBucket,
  mileageBucketLabel,
  normalizeRegion,
  normalizeSeller,
  yearBucket,
} from '../fingerprint';

describe('computeFingerprint', () => {
  it('is deterministic for identical inputs', () => {
    const input = {
      makeSlug: 'skoda',
      modelSlug: 'octavia',
      year: 2018,
      mileageKm: 120_000,
      region: 'Bratislavský',
      sellerName: 'Auto Hron s.r.o.',
      firstPhotoUrl: 'https://s.autobazar.eu/abc/photo-12345.jpg',
    };
    expect(computeFingerprint(input)).toBe(computeFingerprint(input));
  });

  it('produces a 64-char lowercase hex string', () => {
    const fp = computeFingerprint({
      makeSlug: 'vw',
      modelSlug: 'passat',
      year: 2015,
      mileageKm: 180_000,
      region: null,
      sellerName: null,
      firstPhotoUrl: null,
    });
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });

  it('matches across same-seller reposts (mileage within bucket)', () => {
    const base = {
      makeSlug: 'bmw',
      modelSlug: '320d',
      year: 2017,
      region: 'Trnavský',
      sellerName: 'AutoBazár Top',
      firstPhotoUrl: 'https://s.autobazar.eu/x/abc-1.jpg',
    };
    // Seller relisted with 1,200 km more driven — same 5k bucket.
    const a = computeFingerprint({ ...base, mileageKm: 142_000 });
    const b = computeFingerprint({ ...base, mileageKm: 143_200 });
    expect(a).toBe(b);
  });

  it('does not match when mileage crosses a 5k bucket boundary', () => {
    const base = {
      makeSlug: 'bmw',
      modelSlug: '320d',
      year: 2017,
      region: 'Trnavský',
      sellerName: 'AutoBazár Top',
      firstPhotoUrl: 'https://s.autobazar.eu/x/abc-1.jpg',
    };
    const a = computeFingerprint({ ...base, mileageKm: 140_000 });
    const b = computeFingerprint({ ...base, mileageKm: 148_000 });
    expect(a).not.toBe(b);
  });

  it('different sellers with same car spec do NOT collide', () => {
    const base = {
      makeSlug: 'audi',
      modelSlug: 'a4',
      year: 2019,
      mileageKm: 90_000,
      region: 'Košický',
      firstPhotoUrl: 'https://s.autobazar.eu/y/foo.jpg',
    };
    const a = computeFingerprint({ ...base, sellerName: 'Dealer A' });
    const b = computeFingerprint({ ...base, sellerName: 'Dealer B' });
    expect(a).not.toBe(b);
  });

  it('seller name normalization handles diacritics + case', () => {
    expect(normalizeSeller('Auto Hron s.r.o.')).toBe(normalizeSeller('AUTO HRON s.r.o.'));
    expect(normalizeSeller('Žiarský bazár')).toBe(normalizeSeller('ziarsky-bazar'));
  });

  it('region normalization is case + diacritic insensitive', () => {
    expect(normalizeRegion('Bratislavský')).toBe(normalizeRegion('bratislavsky'));
  });

  it('photo basename strips host + extension', () => {
    expect(
      extractPhotoBasename('https://s.autobazar.eu/abc/photo-12345.jpg'),
    ).toBe('photo-12345');
    expect(
      extractPhotoBasename('https://cdn.example.com/path/IMG_0042.png?v=1'),
    ).toBe('IMG_0042');
  });

  it('photo basename returns no-photo for null/garbage', () => {
    expect(extractPhotoBasename(null)).toBe('no-photo');
    expect(extractPhotoBasename('not a url')).toBe('no-photo');
  });

  it('handles null fields gracefully (no crash)', () => {
    const fp = computeFingerprint({
      makeSlug: null,
      modelSlug: null,
      year: null,
      mileageKm: null,
      region: null,
      sellerName: null,
      firstPhotoUrl: null,
    });
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('mileageBucket (numeric, for fingerprint)', () => {
  it('floors to nearest 5,000', () => {
    expect(mileageBucket(0)).toBe('0');
    expect(mileageBucket(4999)).toBe('0');
    expect(mileageBucket(5000)).toBe('5000');
    expect(mileageBucket(149_900)).toBe('145000');
    expect(mileageBucket(150_000)).toBe('150000');
  });

  it('returns unknown for null / negative', () => {
    expect(mileageBucket(null)).toBe('unknown');
    expect(mileageBucket(-1)).toBe('unknown');
  });
});

describe('yearBucket / mileageBucketLabel (for snapshots)', () => {
  it('year buckets', () => {
    expect(yearBucket(2024)).toBe('2020+');
    expect(yearBucket(2018)).toBe('2015-19');
    expect(yearBucket(2012)).toBe('2010-14');
    expect(yearBucket(2008)).toBe('<2010');
    expect(yearBucket(null)).toBe('unknown');
  });

  it('mileage bucket labels', () => {
    expect(mileageBucketLabel(30_000)).toBe('0-50k');
    expect(mileageBucketLabel(75_000)).toBe('50-100k');
    expect(mileageBucketLabel(120_000)).toBe('100-150k');
    expect(mileageBucketLabel(200_000)).toBe('150k+');
    expect(mileageBucketLabel(null)).toBe('unknown');
  });
});
