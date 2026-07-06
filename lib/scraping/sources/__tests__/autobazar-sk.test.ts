import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseListingsPage, autobazarSk } from '../autobazar-sk';
import { __resetRobotsCache } from '../../scrape';

// This fixture is REAL, trimmed HTML captured from a live autobazar.sk brand
// page (3 `.item` cards) — not synthetic. A synthetic fixture is what let the
// selector-drift bug (100% null price) pass CI while prod was broken. If the
// site restructures its cards, the coverage canary below goes red.
const FIXTURE = readFileSync(
  fileURLToPath(new URL('../__fixtures__/autobazar-sk-listing.html', import.meta.url)),
  'utf8',
);

beforeEach(() => __resetRobotsCache());
afterEach(() => __resetRobotsCache());

describe('autobazar.sk parseListingsPage', () => {
  it('extracts the three real listing cards from the fixture', () => {
    expect(parseListingsPage(FIXTURE)).toHaveLength(3);
  });

  it('extracts numeric sourceId + absolutized URL from /<id>/<slug>/', () => {
    const [first] = parseListingsPage(FIXTURE);
    expect(first?.sourceId).toBe('28001536');
    expect(first?.url).toBe(
      'https://www.autobazar.sk/28001536/audi-a3-sportback-a3-2-0-tdi-dpf-ambiente-s-tronic-110kw150hp-a6/',
    );
  });

  it('parses price/year/mileage/fuel/transmission from the card', () => {
    const [a3, rs5, q5] = parseListingsPage(FIXTURE);
    expect(a3?.priceEur).toBe(11200);
    expect(a3?.year).toBe(2014);
    expect(a3?.mileageKm).toBe(192000);
    expect(a3?.fuel).toBe('diesel'); // engine badge "2.0 TDI"
    expect(a3?.transmission).toBe('automatic');
    expect(rs5?.priceEur).toBe(56900);
    expect(rs5?.fuel).toBe('gasoline'); // "2.9 TFSI"
    expect(q5?.priceEur).toBe(54000);
  });

  it('maps kraj-code regions ("NR kraj") to the SK- prefixed kraj name', () => {
    const [a3, rs5, q5] = parseListingsPage(FIXTURE);
    expect(a3?.region).toBe('SK-Nitriansky');
    expect(rs5?.region).toBe('SK-Trenčiansky');
    expect(q5?.region).toBe('SK-Košický');
  });

  it('does NOT let equipment text ("elektrické okná") poison fuel', () => {
    // Every parsed fuel must be a real fuel derived from the engine badge /
    // meta line, never a false "electric" bled in from the equipment list.
    const listings = parseListingsPage(FIXTURE);
    for (const l of listings) {
      if (l.fuel === 'electric') {
        // An electric result is only valid if the title actually says so.
        expect(l.rawTitle?.toLowerCase()).toMatch(/e-tron|elektro|ev\b/);
      }
    }
  });

  // COVERAGE CANARY: the whole point of the parser is the market fields. If a
  // future site change breaks the card selector again, price/region coverage
  // collapses to 0 — fail loudly here instead of silently shipping null data.
  it('coverage canary: price AND region are populated on real cards', () => {
    const listings = parseListingsPage(FIXTURE);
    const withPrice = listings.filter((l) => l.priceEur != null).length;
    const withRegion = listings.filter((l) => l.region != null).length;
    expect(withPrice).toBeGreaterThan(0);
    expect(withRegion).toBeGreaterThan(0);
    // On this fixture every card has both.
    expect(withPrice).toBe(listings.length);
    expect(withRegion).toBe(listings.length);
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
    expect(url).toMatch(/^https:\/\/[a-z-]+\.autobazar\.sk\/$/);
    expect(() => new URL(url)).not.toThrow();
  });
});
