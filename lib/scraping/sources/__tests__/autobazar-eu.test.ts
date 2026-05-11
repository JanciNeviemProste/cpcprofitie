import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseListingsPage, autobazarEu } from '../autobazar-eu';

const FIXTURE = readFileSync(
  fileURLToPath(new URL('../__fixtures__/autobazar-eu-listing.html', import.meta.url)),
  'utf8',
);

describe('autobazar.eu parseListingsPage', () => {
  it('extracts /detail/ listings', () => {
    const listings = parseListingsPage(FIXTURE);
    expect(listings).toHaveLength(2);
  });

  it('uses alphaId as sourceId', () => {
    const listings = parseListingsPage(FIXTURE);
    const ids = listings.map((l) => l.sourceId);
    expect(ids).toEqual(['AmQC9-EmTRY', 'AmmFvg1sl3x']);
  });

  it('parses price, year, fuel, transmission from card text', () => {
    const [i30, puma] = parseListingsPage(FIXTURE);
    expect(i30?.priceEur).toBe(11990);
    expect(i30?.year).toBe(2018);
    expect(i30?.fuel).toBe('gasoline');
    expect(i30?.transmission).toBe('manual');
    expect(puma?.priceEur).toBe(26190);
    expect(puma?.year).toBe(2025);
    expect(puma?.transmission).toBe('automatic');
  });

  it('tags SK regions with the SK- prefix', () => {
    const [i30, puma] = parseListingsPage(FIXTURE);
    expect(i30?.region).toBe('SK-Bratislavský');
    expect(puma?.region).toBe('SK-Žilinský');
  });

  it('absolutizes detail URLs', () => {
    const [i30] = parseListingsPage(FIXTURE);
    expect(i30?.url).toBe('https://www.autobazar.eu/detail/hyundai-i30-16-cvvt/AmQC9-EmTRY/');
  });

  it('drops raw HTML from rawPayload', () => {
    const [i30] = parseListingsPage(FIXTURE);
    expect(i30?.rawPayload).toHaveProperty('capturedAt');
    expect(i30?.rawPayload).not.toHaveProperty('html');
  });

  it('source descriptor pageUrl is valid', () => {
    expect(() => new URL(autobazarEu.pageUrl({ page: 3 }))).not.toThrow();
  });
});
