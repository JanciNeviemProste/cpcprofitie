import { describe, expect, it } from 'vitest';
import {
  computeFingerprint,
  extractPhotoBasename,
  hasDiscriminator,
  mileageBucket,
  mileageBucketLabel,
  normalizeRegion,
  normalizeSeller,
  photoIdentity,
  yearBucket,
} from '../fingerprint';

/** An autobazar listing: named seller, CDN photo whose path is an image id. */
const EU = {
  source: 'autobazar.eu',
  sourceId: '123456',
  makeSlug: 'skoda',
  modelSlug: 'octavia',
  year: 2018,
  mileageKm: 120_000,
  region: 'Bratislavský',
  sellerName: 'Auto Hron s.r.o.',
  firstPhotoUrl: 'https://s.autobazar.eu/abc/photo-12345.jpg',
};

describe('computeFingerprint', () => {
  it('is deterministic for identical inputs', () => {
    expect(computeFingerprint(EU)).toBe(computeFingerprint(EU));
  });

  it('produces a 64-char lowercase hex string', () => {
    const fp = computeFingerprint({
      ...EU,
      region: null,
      sellerName: null,
      firstPhotoUrl: null,
      // Year and mileage together still identify a car well enough to guess.
      year: 2015,
      mileageKm: 180_000,
    });
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });

  it('matches across same-seller reposts (mileage within bucket)', () => {
    // Seller relisted with 1,200 km more driven — same 5k bucket.
    const a = computeFingerprint({ ...EU, sourceId: '1', mileageKm: 142_000 });
    const b = computeFingerprint({ ...EU, sourceId: '2', mileageKm: 143_200 });
    expect(a).toBe(b);
  });

  it('does not match when mileage crosses a 5k bucket boundary', () => {
    const a = computeFingerprint({ ...EU, mileageKm: 140_000 });
    const b = computeFingerprint({ ...EU, mileageKm: 148_000 });
    expect(a).not.toBe(b);
    expect(a).not.toBeNull();
  });

  it('different sellers with same car spec do NOT collide', () => {
    const base = { ...EU, firstPhotoUrl: null };
    const a = computeFingerprint({ ...base, sellerName: 'Dealer A' });
    const b = computeFingerprint({ ...base, sellerName: 'Dealer B' });
    expect(a).not.toBe(b);
    expect(a).not.toBeNull();
  });

  it('refuses to fingerprint a listing that carries no identity', () => {
    // Formerly asserted a 64-char hash here, under the name "handles null
    // fields gracefully". Returning a hash was the bug: every such listing got
    // the SAME hash, and the clustering pass read that as "these are all one
    // car" — 681 Octavias, 2001 to 2024, in a single group.
    expect(
      computeFingerprint({
        source: 'bazos.sk',
        sourceId: '1',
        makeSlug: null,
        modelSlug: null,
        year: null,
        mileageKm: null,
        region: null,
        sellerName: null,
        firstPhotoUrl: null,
      }),
    ).toBeNull();
  });

  it('refuses two different cars of the same model rather than merging them', () => {
    // The exact shape of the 681-Octavia group: make and model known, nothing
    // else. These are not the same car and must not share a fingerprint —
    // returning null for both is how that is guaranteed.
    const shape = {
      source: 'bazos.sk',
      makeSlug: 'skoda',
      modelSlug: 'octavia',
      year: null,
      mileageKm: null,
      region: null,
      sellerName: null,
    };
    const a = computeFingerprint({
      ...shape,
      sourceId: '194679632',
      firstPhotoUrl: 'https://www.bazos.sk/img/1/632/194679632.jpg',
    });
    const b = computeFingerprint({
      ...shape,
      sourceId: '194731342',
      firstPhotoUrl: 'https://www.bazos.sk/img/1t/342/194731342.jpg?t=1787134267',
    });
    expect(a).toBeNull();
    expect(b).toBeNull();
  });

  it('a region alone is not an identity', () => {
    // A county holds thousands of Octavias.
    expect(
      computeFingerprint({
        source: 'bazos.sk',
        sourceId: '1',
        makeSlug: 'skoda',
        modelSlug: 'octavia',
        year: 2018,
        mileageKm: null,
        region: 'Bratislavský',
        sellerName: null,
        firstPhotoUrl: null,
      }),
    ).toBeNull();
  });
});

describe('photoIdentity', () => {
  it('ignores a photo URL that merely restates the advert id', () => {
    // 19 940 of 20 133 bazoš listings are like this: advert 194731342 is
    // pictured at /img/1t/342/194731342.jpg. Treating that as identity would
    // make the fingerprint a bijection with the advert id — no repost could
    // ever match, and sold-detector would read "nothing else shares this
    // fingerprint" as proof of sale for every removed bazoš advert.
    expect(
      photoIdentity(
        'bazos.sk',
        'https://www.bazos.sk/img/1t/373/191942373.jpg?t=1779301365',
        '191942373',
      ),
    ).toBeNull();
    expect(
      photoIdentity('bazos.sk', 'https://www.bazos.sk/img/1/632/194679632.jpg', '194679632'),
    ).toBeNull();
  });

  it('keeps a CDN photo id that has nothing to do with the advert id', () => {
    expect(
      photoIdentity(
        'autobazar.eu',
        'https://img.autobazar.eu/foto/xyz/SdRpx7QTB_fss?st=a&ts=1',
        '99',
      ),
    ).toBe('autobazar.eu:SdRpx7QTB_fss');
  });

  it('ignores a stand-in image served when the advert has no photo', () => {
    // The real one: 193 bazoš adverts share this gif. Treating it as identity
    // would merge all 193 into one car — the original bug in miniature.
    expect(
      photoIdentity('bazos.sk', 'https://www.bazos.sk/obrazky/empty.gif', '194498950'),
    ).toBeNull();
    expect(photoIdentity('autobazar.eu', 'https://x/y/placeholder.png', '1')).toBeNull();
  });

  it('is null when there is no photo at all', () => {
    expect(photoIdentity('autobazar.eu', null, '1')).toBeNull();
    expect(photoIdentity('autobazar.eu', 'not a url', '1')).toBeNull();
  });

  it('does not let two sources collide on the same basename', () => {
    expect(photoIdentity('autobazar.eu', 'https://a/x/abc.jpg', '1')).not.toBe(
      photoIdentity('autobazar.sk', 'https://b/y/abc.jpg', '1'),
    );
  });
});

describe('hasDiscriminator', () => {
  it('accepts a photo, a seller, or a year+mileage pair', () => {
    const none = { year: null, mileageKm: null, sellerName: null, photo: null };
    expect(hasDiscriminator(none)).toBe(false);
    expect(hasDiscriminator({ ...none, photo: 'eu:abc' })).toBe(true);
    expect(hasDiscriminator({ ...none, sellerName: 'Auto Hron' })).toBe(true);
    expect(hasDiscriminator({ ...none, year: 2018, mileageKm: 120_000 })).toBe(true);
  });

  it('rejects a year or a mileage on its own', () => {
    const none = { year: null, mileageKm: null, sellerName: null, photo: null };
    expect(hasDiscriminator({ ...none, year: 2018 })).toBe(false);
    expect(hasDiscriminator({ ...none, mileageKm: 120_000 })).toBe(false);
  });

  it('rejects a blank seller name', () => {
    expect(hasDiscriminator({ year: null, mileageKm: null, sellerName: '   ', photo: null })).toBe(
      false,
    );
  });
});

describe('normalization helpers', () => {
  it('seller name normalization handles diacritics + case', () => {
    expect(normalizeSeller('Auto Hron s.r.o.')).toBe(normalizeSeller('AUTO HRON s.r.o.'));
    expect(normalizeSeller('Žiarský bazár')).toBe(normalizeSeller('ziarsky-bazar'));
  });

  it('region normalization is case + diacritic insensitive', () => {
    expect(normalizeRegion('Bratislavský')).toBe(normalizeRegion('bratislavsky'));
  });

  it('photo basename strips host + extension', () => {
    expect(extractPhotoBasename('https://s.autobazar.eu/abc/photo-12345.jpg')).toBe('photo-12345');
    expect(extractPhotoBasename('https://cdn.example.com/path/IMG_0042.png?v=1')).toBe('IMG_0042');
  });

  it('photo basename returns no-photo for null/garbage', () => {
    expect(extractPhotoBasename(null)).toBe('no-photo');
    expect(extractPhotoBasename('not a url')).toBe('no-photo');
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

  it('returns unknown for null/negative', () => {
    expect(mileageBucket(null)).toBe('unknown');
    expect(mileageBucket(-1)).toBe('unknown');
  });
});

describe('yearBucket / mileageBucketLabel (cohort grouping)', () => {
  it('maps years to cohort buckets', () => {
    expect(yearBucket(2021)).toBe('2020+');
    expect(yearBucket(2016)).toBe('2015-19');
    expect(yearBucket(2011)).toBe('2010-14');
    expect(yearBucket(2004)).toBe('<2010');
    expect(yearBucket(null)).toBe('unknown');
  });

  it('maps mileage to cohort buckets', () => {
    expect(mileageBucketLabel(10_000)).toBe('0-50k');
    expect(mileageBucketLabel(75_000)).toBe('50-100k');
    expect(mileageBucketLabel(120_000)).toBe('100-150k');
    expect(mileageBucketLabel(200_000)).toBe('150k+');
    expect(mileageBucketLabel(null)).toBe('unknown');
  });
});
