import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __resetRobotsCache, parseListingsPage } from '../autobazar-sk';

// __dirname isn't defined under ESM; resolve relative to this file's URL.
const FIXTURE = readFileSync(
  fileURLToPath(new URL('../__fixtures__/autobazar-sk-listing.html', import.meta.url)),
  'utf8',
);

beforeEach(() => __resetRobotsCache());
afterEach(() => __resetRobotsCache());

describe('parseListingsPage (autobazar.sk fixture)', () => {
  it('extracts every card from the fixture', () => {
    const listings = parseListingsPage(FIXTURE);
    expect(listings).toHaveLength(3);
  });

  it('makes relative listing URLs absolute against the BASE host', () => {
    const listings = parseListingsPage(FIXTURE);
    expect(listings[0]?.url).toBe('https://www.autobazar.sk/auto/abc-123/');
  });

  it('preserves already-absolute listing URLs verbatim', () => {
    const listings = parseListingsPage(FIXTURE);
    expect(listings[1]?.url).toBe('https://www.autobazar.sk/auto/def-456/');
  });

  it('parses Slovak prices, mileages, years, fuel, transmission, region', () => {
    const [octavia, bmw] = parseListingsPage(FIXTURE);
    expect(octavia?.priceEur).toBe(14990);
    expect(octavia?.mileageKm).toBe(120000);
    expect(octavia?.year).toBe(2019);
    expect(octavia?.fuel).toBe('diesel');
    expect(octavia?.transmission).toBe('manual');
    expect(octavia?.region).toBe('Bratislavský');
    expect(bmw?.priceEur).toBe(22500);
    expect(bmw?.transmission).toBe('automatic');
  });

  it('coerces unparseable price / mileage to null without dropping the row', () => {
    const audi = parseListingsPage(FIXTURE)[2];
    expect(audi?.rawTitle).toContain('Audi A4');
    expect(audi?.priceEur).toBeNull();
    expect(audi?.mileageKm).toBeNull();
  });

  it('returns an empty array on a no-cards page', () => {
    const empty = parseListingsPage('<html><body><p>nič</p></body></html>');
    expect(empty).toEqual([]);
  });

  it('extracts a stable sourceId from the URL path', () => {
    const ids = parseListingsPage(FIXTURE).map((l) => l.sourceId);
    expect(ids).toEqual(['abc-123', 'def-456', 'ghi-789']);
  });
});
