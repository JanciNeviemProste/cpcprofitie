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

// ── Dealer-written headers ───────────────────────────────────────────────────
// Only a minority of ads use Bazoš's own "Rok výroby:" field; dealers write
// their own. Both fixtures are real pages captured 2026-08-19, and both also
// carry a *neighbouring* listing's labels in the page body — which is how a
// body-wide lookup used to assign another car's year to this one.

const DEALER_RV = readFileSync(
  fileURLToPath(new URL('../__fixtures__/bazos-sk-detail-dealer-rv.html', import.meta.url)),
  'utf8',
);
const DEALER_EVIDENCIA = readFileSync(
  fileURLToPath(new URL('../__fixtures__/bazos-sk-detail-dealer-evidencia.html', import.meta.url)),
  'utf8',
);

function stub(sourceId: string, url: string): NormalizedListing {
  return {
    ...STUB_LISTING,
    sourceId,
    url,
    priceEur: null,
    year: null,
    mileageKm: null,
  };
}

describe('bazos.sk detail — dealer-written headers', () => {
  it('reads "r.v.: 01/2018" and does not take the sidebar\'s "Rok výroby: 7/2021"', () => {
    const d = parseDetailPage(
      DEALER_RV,
      stub('194711273', 'https://auto.bazos.sk/inzerat/194711273/toyota-c-hr-18-hybrid.php'),
    );
    expect(d.listingOverrides?.year).toBe(2018);
  });

  it('prefers first registration over the marketing MODEL year', () => {
    // The page says both "MODEL 2020" and "Prvá evidencia 11/2019".
    const d = parseDetailPage(
      DEALER_EVIDENCIA,
      stub(
        '194708206',
        'https://auto.bazos.sk/inzerat/194708206/ford-focus-kombi-15-tdci-ecoblue-active-at.php',
      ),
    );
    expect(d.listingOverrides?.year).toBe(2019);
  });

  it('reads an odometer written with a dot as the thousands mark', () => {
    // "NAJAZDENÉ 203.336KM" — the separator is thousands, never a decimal.
    const d = parseDetailPage(
      DEALER_EVIDENCIA,
      stub(
        '194708206',
        'https://auto.bazos.sk/inzerat/194708206/ford-focus-kombi-15-tdci-ecoblue-active-at.php',
      ),
    );
    expect(d.listingOverrides?.mileageKm).toBe(203336);
  });

  it('ignores fuel-consumption figures when falling back to an unlabelled odometer', () => {
    // Both pages contain "…/100 km" style numbers; none may become mileage.
    for (const html of [DEALER_RV, DEALER_EVIDENCIA]) {
      const km = parseDetailPage(html, stub('x', 'https://auto.bazos.sk/inzerat/x/y.php'))
        .listingOverrides?.mileageKm;
      expect(km == null || km >= 1000).toBe(true);
    }
  });
});
