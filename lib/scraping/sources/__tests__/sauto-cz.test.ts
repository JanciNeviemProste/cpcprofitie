import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseListingsPage, sautoCz } from '../sauto-cz';

const FIXTURE = readFileSync(
  fileURLToPath(new URL('../__fixtures__/sauto-cz-listing.html', import.meta.url)),
  'utf8',
);

describe('sauto.cz parseListingsPage', () => {
  it('extracts both listings from the fixture', () => {
    expect(parseListingsPage(FIXTURE)).toHaveLength(2);
  });

  it('converts CZK prices to EUR and keeps the raw CZK', () => {
    const [octavia] = parseListingsPage(FIXTURE);
    expect(octavia?.priceCzk).toBe(385000);
    // 385 000 / 25 ≈ 15400
    expect(octavia?.priceEur).toBe(Math.round(385000 / 25));
  });

  it('prefixes region with CZ- so dashboards can split SK vs CZ', () => {
    const [octavia, bmw] = parseListingsPage(FIXTURE);
    expect(octavia?.region).toBe('CZ-Praha');
    expect(bmw?.region).toBe('CZ-Brno');
  });

  it('maps Czech "Manuální" / "Automatická" to canonical enums', () => {
    const [octavia, bmw] = parseListingsPage(FIXTURE);
    expect(octavia?.transmission).toBe('manual');
    expect(bmw?.transmission).toBe('automatic');
  });

  it('preserves already-absolute URLs and absolutizes relative ones', () => {
    const [octavia, bmw] = parseListingsPage(FIXTURE);
    expect(octavia?.url).toBe('https://www.sauto.cz/osobni-auta/skoda/octavia/123456');
    expect(bmw?.url).toBe('https://www.sauto.cz/osobni-auta/bmw/3-series/789012');
  });

  it('extracts numeric sourceId from the URL tail', () => {
    const listings = parseListingsPage(FIXTURE);
    expect(listings.map((l) => l.sourceId)).toEqual(['123456', '789012']);
  });

  it('tags listings with source=sauto.cz', () => {
    for (const l of parseListingsPage(FIXTURE)) {
      expect(l.source).toBe('sauto.cz');
    }
  });
});

describe('sauto.cz source descriptor', () => {
  it('pageUrl uses strana= pagination', () => {
    expect(sautoCz.pageUrl({ page: 5 })).toContain('strana=5');
  });
});
