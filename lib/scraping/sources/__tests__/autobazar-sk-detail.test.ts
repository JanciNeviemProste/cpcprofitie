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

  it('emits NO price for a price-on-request page even when body has other € figures', () => {
    // "Cena dohodou" page: empty price box, but a financing widget and a
    // related-listing carousel carry € amounts. A body-first-€ scan would
    // grab the akontácia (2 576 €) — the price element anchor must not.
    const dohodou =
      '<html><body>' +
      '<div class="p-amount"></div>' +
      '<div class="finance">Výška akontácie <span>2 576</span> €</div>' +
      '<div class="similar"><a>Iné Audi</a> 18 900 €</div>' +
      '</body></html>';
    const d = parseDetailPage(dohodou, LISTING);
    expect(d.listingOverrides?.priceEur).toBeUndefined();
  });

  it('rejects an out-of-bounds price in the price element', () => {
    const junk = '<html><body><h2 class="p-amount">1 500 000 €</h2></body></html>';
    const d = parseDetailPage(junk, LISTING);
    expect(d.listingOverrides?.priceEur).toBeUndefined();
  });

  it('captures seller type and photos', () => {
    const d = parseDetailPage(FIXTURE, LISTING);
    expect(d.sellerType).toBe('dealer');
    expect(d.photos.length).toBeGreaterThan(0);
  });
});
