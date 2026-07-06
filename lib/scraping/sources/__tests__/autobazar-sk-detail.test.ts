import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseDetailPage } from '../autobazar-sk-detail';
import type { NormalizedListing } from '../../types';

// Real, trimmed detail page captured from autobazar.sk (scripts/styles removed).
const FIXTURE = readFileSync(
  fileURLToPath(new URL('../__fixtures__/autobazar-sk-detail.html', import.meta.url)),
  'utf8',
);

const LISTING: NormalizedListing = {
  source: 'autobazar.sk',
  sourceId: '28001536',
  url: 'https://www.autobazar.sk/28001536/audi-a3/',
  makeSlug: 'audi',
  modelSlug: 'audi-a3',
  priceEur: null,
  year: null,
  mileageKm: null,
  fuel: null,
  transmission: null,
  region: null,
  rawTitle: null,
  rawPayload: {},
};

describe('autobazar.sk parseDetailPage', () => {
  it('extracts the sale price into listingOverrides (backfills null-price rows)', () => {
    const d = parseDetailPage(FIXTURE, LISTING);
    expect(d.listingOverrides?.priceEur).toBe(11200);
  });

  it('backfills year/mileage/fuel/transmission from the detail specs', () => {
    const d = parseDetailPage(FIXTURE, LISTING);
    expect(d.listingOverrides?.year).toBe(2014);
    expect(d.listingOverrides?.mileageKm).toBe(192000);
    expect(d.listingOverrides?.fuel).toBe('diesel');
    expect(d.listingOverrides?.transmission).toBe('automatic');
  });

  it('does NOT emit a region override (detail location is unreliable)', () => {
    const d = parseDetailPage(FIXTURE, LISTING);
    expect(d.listingOverrides?.region).toBeUndefined();
  });

  it('captures seller type and photos', () => {
    const d = parseDetailPage(FIXTURE, LISTING);
    expect(d.sellerType).toBe('dealer');
    expect(d.photos.length).toBeGreaterThan(0);
  });
});
