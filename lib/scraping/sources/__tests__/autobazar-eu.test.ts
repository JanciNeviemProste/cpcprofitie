import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { autobazarEu, BRAND_MODEL_BUCKETS, parseListingsPage } from '../autobazar-eu';

const FIXTURE = readFileSync(
  fileURLToPath(new URL('../__fixtures__/autobazar-eu-listing.html', import.meta.url)),
  'utf8',
);

describe('autobazar.eu parseListingsPage', () => {
  it('extracts listings from __NEXT_DATA__ JSON', () => {
    const listings = parseListingsPage(FIXTURE);
    expect(listings.length).toBeGreaterThanOrEqual(2);
  });

  it('uses the alphaId field as sourceId', () => {
    const [first] = parseListingsPage(FIXTURE);
    expect(first?.sourceId).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(first?.sourceId.length).toBeGreaterThan(5);
  });

  it('produces canonical /detail/x/<id>/ URLs that redirect to slugged form', () => {
    const [first] = parseListingsPage(FIXTURE);
    expect(first?.url).toBe(`https://www.autobazar.eu/detail/x/${first?.sourceId}/`);
  });

  it('pulls price, year, mileage and fuel from JSON fields', () => {
    const [first] = parseListingsPage(FIXTURE);
    expect(first?.priceEur).toBeGreaterThan(0);
    expect(first?.year).toBeGreaterThan(1990);
    expect(first?.year).toBeLessThan(2030);
    expect(first?.mileageKm).toBeGreaterThan(0);
    expect(first?.fuel).not.toBeNull();
  });

  it('extracts brand+model slugs from brandValue/carModelValue', () => {
    const [first] = parseListingsPage(FIXTURE);
    expect(first?.makeSlug).toBeTruthy();
    expect(first?.modelSlug).toBeTruthy();
  });

  it('keeps rawPayload minimal (no raw HTML)', () => {
    const [first] = parseListingsPage(FIXTURE);
    expect(first?.rawPayload).toHaveProperty('capturedAt');
    expect(first?.rawPayload).not.toHaveProperty('html');
  });

  it('returns [] when __NEXT_DATA__ is missing', () => {
    expect(parseListingsPage('<html><body><p>no script</p></body></html>')).toEqual([]);
  });

  it('source descriptor pageUrl is valid and cycles brand+model buckets', () => {
    expect(BRAND_MODEL_BUCKETS.length).toBeGreaterThan(50);
    const url1 = autobazarEu.pageUrl({ page: 1 });
    const url2 = autobazarEu.pageUrl({ page: 2 });
    expect(() => new URL(url1)).not.toThrow();
    expect(() => new URL(url2)).not.toThrow();
    // page 1 may be a brand-only bucket (.../skoda/) and page 2 may be
    // brand+model (.../skoda/octavia/). Both shapes are valid.
    expect(url1).toMatch(
      /^https:\/\/www\.autobazar\.eu\/vysledky\/osobne-vozidla\/[a-z0-9-]+\/([a-z0-9-]+\/)?$/,
    );
    expect(url1).not.toBe(url2);
  });
});
