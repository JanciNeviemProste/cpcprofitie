import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseListingsPage, autobazarEu } from '../autobazar-eu';

const FIXTURE = readFileSync(
  fileURLToPath(new URL('../__fixtures__/autobazar-eu-listing.html', import.meta.url)),
  'utf8',
);

describe('autobazar.eu parseListingsPage', () => {
  it('extracts both cards from the fixture', () => {
    const listings = parseListingsPage(FIXTURE);
    expect(listings).toHaveLength(2);
  });

  it('builds absolute URL from relative href', () => {
    const [first] = parseListingsPage(FIXTURE);
    expect(first?.url).toBe('https://www.autobazar.eu/inzerat/skoda-octavia-123/');
  });

  it('keeps already-absolute URLs', () => {
    const listings = parseListingsPage(FIXTURE);
    expect(listings[1]?.url).toBe('https://www.autobazar.eu/inzerat/vw-passat-456/');
  });

  it('parses price, year, mileage, fuel, transmission, region', () => {
    const [octavia] = parseListingsPage(FIXTURE);
    expect(octavia?.priceEur).toBe(12990);
    expect(octavia?.year).toBe(2018);
    expect(octavia?.mileageKm).toBe(145000);
    expect(octavia?.fuel).toBe('diesel');
    expect(octavia?.transmission).toBe('manual');
    expect(octavia?.region).toBe('Nitriansky');
  });

  it('tags every listing with source=autobazar.eu', () => {
    for (const l of parseListingsPage(FIXTURE)) {
      expect(l.source).toBe('autobazar.eu');
    }
  });

  it('returns [] on an empty page', () => {
    expect(parseListingsPage('<html><body></body></html>')).toEqual([]);
  });
});

describe('autobazar.eu source descriptor', () => {
  it('pageUrl produces a valid URL with the expected query', () => {
    const url = autobazarEu.pageUrl({ page: 3 });
    expect(url).toContain('strana=3');
    expect(() => new URL(url)).not.toThrow();
  });
});
