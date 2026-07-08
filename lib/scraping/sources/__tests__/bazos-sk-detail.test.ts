import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseDetailPage } from '../bazos-sk-detail';
import type { NormalizedListing } from '../../types';

const FIXTURE = readFileSync(
  fileURLToPath(new URL('../__fixtures__/bazos-sk-detail.html', import.meta.url)),
  'utf8',
);

// A legacy title-less/model-less stub: this is exactly the ~18k bazos rows the
// detail backfill targets — no makeSlug/modelSlug/rawTitle to start with.
const STUB_LISTING: NormalizedListing = {
  source: 'bazos.sk',
  sourceId: '193430711',
  url: 'https://auto.bazos.sk/inzerat/193430711/ford-kuga.php',
  makeSlug: null,
  modelSlug: null,
  priceEur: 15490,
  year: null,
  mileageKm: null,
  fuel: null,
  transmission: null,
  region: null,
  rawTitle: null,
  rawPayload: { capturedAt: '2026-05-12T05:20:06.000Z' },
};

describe('bazos.sk parseDetailPage', () => {
  it('recovers make/model/title identity for stub backfill', () => {
    // Same parseMakeModel the list parser uses, so a detail-backfilled model_id
    // lands on the exact vehicle_models row a list scrape would produce.
    const d = parseDetailPage(FIXTURE, STUB_LISTING);
    expect(d.identity?.makeSlug).toBe('ford');
    expect(d.identity?.modelSlug).toBe('ford-kuga');
    expect(d.identity?.rawTitle).toMatch(/Ford Kuga/i);
  });

  it('extracts id-filtered photos from the CDN', () => {
    const d = parseDetailPage(FIXTURE, STUB_LISTING);
    expect(d.photos.length).toBeGreaterThan(0);
    expect(d.photos.every((p) => p.includes('193430711'))).toBe(true);
  });

  it('reads VIN and patches NULL year/mileage/region via overrides', () => {
    const d = parseDetailPage(FIXTURE, STUB_LISTING);
    expect(d.vin).toMatch(/^[A-HJ-NPR-Z0-9]{17}$/);
    expect(d.listingOverrides?.year).toBe(2020);
    expect(d.listingOverrides?.mileageKm).toBe(120000);
    expect(d.listingOverrides?.region).toMatch(/Tren/i);
  });

  it('recovers price from .inzeratycena, not a related-listing € span', () => {
    // Drains the ~8k legacy price-null stubs. The fixture has a sidebar listing
    // priced 33 000 € after the car's own 15 490 € — anchoring on .inzeratycena
    // .first() must pick THIS car's price, never the neighbour's.
    const d = parseDetailPage(FIXTURE, STUB_LISTING);
    expect(d.listingOverrides?.priceEur).toBe(15490);
  });

  it('leaves price unset when there is no price element', () => {
    const noPrice = '<html><body><h1>Ford Kuga</h1></body></html>';
    const d = parseDetailPage(noPrice, STUB_LISTING);
    expect(d.listingOverrides?.priceEur).toBeUndefined();
  });

  it('returns no identity when the title is missing', () => {
    const d = parseDetailPage('<html><body></body></html>', STUB_LISTING);
    expect(d.identity).toBeUndefined();
    expect(d.photos).toEqual([]);
    expect(d.vin).toBeNull();
  });
});
