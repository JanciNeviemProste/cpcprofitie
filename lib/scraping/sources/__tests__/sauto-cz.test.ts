import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseListingsPage, sautoCz } from '../sauto-cz';

const FIXTURE = readFileSync(
  fileURLToPath(new URL('../__fixtures__/sauto-cz-listing.html', import.meta.url)),
  'utf8',
);

describe('sauto.cz parseListingsPage', () => {
  it('extracts /osobni/detail/<brand>/<model>/<id> anchors', () => {
    expect(parseListingsPage(FIXTURE)).toHaveLength(2);
  });

  it('extracts numeric sourceId from the URL tail', () => {
    expect(parseListingsPage(FIXTURE).map((l) => l.sourceId)).toEqual([
      '210399851',
      '210400123',
    ]);
  });

  it('parses CZK price and converts to EUR', () => {
    const [octavia] = parseListingsPage(FIXTURE);
    expect(octavia?.priceCzk).toBe(469000);
    expect(octavia?.priceEur).toBe(Math.round(469000 / 25));
  });

  it('parses year, mileage, fuel, transmission from meta line', () => {
    const [octavia, bmw] = parseListingsPage(FIXTURE);
    expect(octavia?.year).toBe(2022);
    expect(octavia?.mileageKm).toBe(62200);
    expect(octavia?.fuel).toBe('gasoline');
    expect(octavia?.transmission).toBe('automatic');
    expect(bmw?.year).toBe(2020);
    expect(bmw?.fuel).toBe('diesel');
  });

  it('reads title from inner <h3>', () => {
    const [octavia] = parseListingsPage(FIXTURE);
    expect(octavia?.rawTitle).toContain('Škoda Octavia');
  });

  it('prefixes CZ regions with CZ-', () => {
    const [octavia, bmw] = parseListingsPage(FIXTURE);
    expect(octavia?.region).toBe('CZ-Praha-západ');
    expect(bmw?.region).toBe('CZ-Brno');
  });

  it('drops raw HTML from rawPayload', () => {
    const [octavia] = parseListingsPage(FIXTURE);
    expect(octavia?.rawPayload).toHaveProperty('capturedAt');
    expect(octavia?.rawPayload).not.toHaveProperty('html');
  });

  it('pagination uses ?strana=N', () => {
    expect(sautoCz.pageUrl({ page: 5 })).toContain('strana=5');
  });
});
