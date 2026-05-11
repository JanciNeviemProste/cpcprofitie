import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { bazosSk, parseListingsPage } from '../bazos-sk';

const FIXTURE = readFileSync(
  fileURLToPath(new URL('../__fixtures__/bazos-sk-listing.html', import.meta.url)),
  'utf8',
);

describe('bazos.sk parseListingsPage', () => {
  it('extracts listings from the fixture', () => {
    const listings = parseListingsPage(FIXTURE);
    expect(listings.length).toBeGreaterThanOrEqual(2);
  });

  it('parses year + km + fuel + transmission from description text', () => {
    const listings = parseListingsPage(FIXTURE);
    const octavia = listings.find((l) => l.rawTitle?.includes('Octavia'));
    expect(octavia?.year).toBe(2017);
    expect(octavia?.mileageKm).toBe(165000);
    expect(octavia?.fuel).toBe('diesel');
    expect(octavia?.transmission).toBe('manual');
  });

  it('parses BMW listing with automat transmission', () => {
    const listings = parseListingsPage(FIXTURE);
    const bmw = listings.find((l) => l.rawTitle?.includes('BMW'));
    expect(bmw?.year).toBe(2020);
    expect(bmw?.transmission).toBe('automatic');
    expect(bmw?.priceEur).toBe(21500);
  });

  it('extracts numeric sourceId from /inzerat/<id>/ URLs', () => {
    const listings = parseListingsPage(FIXTURE);
    expect(listings.map((l) => l.sourceId)).toContain('111222');
    expect(listings.map((l) => l.sourceId)).toContain('333444');
  });

  it('tags listings with source=bazos.sk', () => {
    for (const l of parseListingsPage(FIXTURE)) {
      expect(l.source).toBe('bazos.sk');
    }
  });
});

describe('bazos.sk source descriptor', () => {
  it('pageUrl uses strana= pagination', () => {
    expect(bazosSk.pageUrl({ page: 2 })).toContain('strana=2');
  });
});
