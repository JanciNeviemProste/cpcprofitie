import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseDetailPage } from '../autobazar-eu-detail';
import type { NormalizedListing } from '../../types';

const FIXTURE = readFileSync(
  fileURLToPath(new URL('../__fixtures__/autobazar-eu-detail.html', import.meta.url)),
  'utf8',
);

const STUB_LISTING: NormalizedListing = {
  source: 'autobazar.eu',
  sourceId: 'AeDlfxb6rI2',
  url: 'https://www.autobazar.eu/detail/x/AeDlfxb6rI2/',
  makeSlug: 'skoda',
  modelSlug: 'superb-combi',
  priceEur: 13300,
  year: 2019,
  mileageKm: 265562,
  fuel: 'diesel',
  transmission: 'automatic',
  region: 'SK-Žilinský kraj',
  rawTitle: 'Skoda Superb Combi 2.0 TDI',
  rawPayload: { capturedAt: '2026-05-12T05:20:06.000Z' },
};

describe('autobazar.eu parseDetailPage', () => {
  it('extracts photo URLs from images[] in __NEXT_DATA__', () => {
    const d = parseDetailPage(FIXTURE, STUB_LISTING);
    expect(d.photos.length).toBeGreaterThan(0);
    expect(d.photos[0]).toMatch(/^https:\/\/img\.autobazar\.eu\//);
  });

  it('reads VIN when present and shaped correctly', () => {
    const d = parseDetailPage(FIXTURE, STUB_LISTING);
    expect(d.vin).toMatch(/^[A-HJ-NPR-Z0-9]{17}$/);
  });

  it('reads seller info — dealer flagged when idFirm is set', () => {
    const d = parseDetailPage(FIXTURE, STUB_LISTING);
    expect(d.sellerName).toBeTruthy();
    expect(d.sellerType).toBe('dealer');
  });

  it('reads body type and engine power', () => {
    const d = parseDetailPage(FIXTURE, STUB_LISTING);
    expect(d.bodyType).toBeTruthy();
    expect(d.powerKw).toBeGreaterThan(0);
  });

  it('recovers make/model/title identity for stub backfill', () => {
    // Same slug logic as the list parser, so a detail-backfilled model_id
    // lands on the exact vehicle_models row a list scrape would use.
    const d = parseDetailPage(FIXTURE, STUB_LISTING);
    expect(d.identity?.makeSlug).toBe('skoda');
    expect(d.identity?.modelSlug).toBe('superb-combi');
    expect(d.identity?.rawTitle).toMatch(/Superb Combi/i);
  });

  it('returns safe defaults when __NEXT_DATA__ is missing', () => {
    const d = parseDetailPage('<html><body></body></html>', STUB_LISTING);
    expect(d.photos).toEqual([]);
    expect(d.vin).toBeNull();
    expect(d.sellerName).toBeNull();
    expect(d.identity).toBeUndefined();
  });
});
