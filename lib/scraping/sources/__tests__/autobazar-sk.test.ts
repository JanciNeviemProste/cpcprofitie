import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseListingsPage, autobazarSk } from '../autobazar-sk';
import { __resetRobotsCache } from '../../scrape';

const FIXTURE = readFileSync(
  fileURLToPath(new URL('../__fixtures__/autobazar-sk-listing.html', import.meta.url)),
  'utf8',
);

beforeEach(() => __resetRobotsCache());
afterEach(() => __resetRobotsCache());

describe('autobazar.sk parseListingsPage', () => {
  it('extracts every listing-shaped anchor from the fixture', () => {
    const listings = parseListingsPage(FIXTURE);
    expect(listings).toHaveLength(3);
  });

  it('ignores non-listing anchors (footer, login, etc.)', () => {
    const listings = parseListingsPage(FIXTURE);
    const ids = listings.map((l) => l.sourceId);
    expect(ids).not.toContain('o-portali');
    expect(ids).not.toContain('login');
  });

  it('extracts numeric sourceId from /<numericId>/<slug>/ URLs', () => {
    const ids = parseListingsPage(FIXTURE).map((l) => l.sourceId);
    expect(ids).toEqual(['28199857', '29001122', '29002233']);
  });

  it('absolutizes URLs against autobazar.sk host', () => {
    const [first] = parseListingsPage(FIXTURE);
    expect(first?.url).toBe('https://www.autobazar.sk/28199857/skoda-octavia-1-6-tdi-combi/');
  });

  it('parses price, year, mileage, fuel, transmission from card text', () => {
    const [octavia, bmw] = parseListingsPage(FIXTURE);
    expect(octavia?.priceEur).toBe(12990);
    expect(octavia?.year).toBe(2019);
    expect(octavia?.mileageKm).toBe(145000);
    expect(octavia?.fuel).toBe('diesel');
    expect(octavia?.transmission).toBe('manual');
    expect(bmw?.priceEur).toBe(22500);
    expect(bmw?.transmission).toBe('automatic');
  });

  it('tags SK regions with the SK- prefix', () => {
    const [octavia, bmw] = parseListingsPage(FIXTURE);
    expect(octavia?.region).toBe('SK-Bratislavský');
    expect(bmw?.region).toBe('SK-Košický');
  });

  it('drops raw HTML from rawPayload (only capturedAt remains)', () => {
    const [first] = parseListingsPage(FIXTURE);
    expect(first?.rawPayload).toHaveProperty('capturedAt');
    expect(first?.rawPayload).not.toHaveProperty('html');
  });

  it('returns [] on a no-listings page', () => {
    expect(parseListingsPage('<html><body><p>nič</p></body></html>')).toEqual([]);
  });

  it('source descriptor pageUrl is valid', () => {
    const url = autobazarSk.pageUrl({ page: 2 });
    // page index now selects a brand subdomain instead of ?page=N
    expect(url).toMatch(/^https:\/\/[a-z-]+\.autobazar\.sk\/$/);
    expect(() => new URL(url)).not.toThrow();
  });
});
