import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { bazosSk, parseListingsPage } from '../bazos-sk';

const FIXTURE = readFileSync(
  fileURLToPath(new URL('../__fixtures__/bazos-sk-listing.html', import.meta.url)),
  'utf8',
);

describe('bazos.sk parseListingsPage', () => {
  it('extracts /inzerat/<id>/<slug>.php anchors', () => {
    const listings = parseListingsPage(FIXTURE);
    expect(listings).toHaveLength(2);
  });

  it('extracts numeric sourceId from URL', () => {
    const ids = parseListingsPage(FIXTURE).map((l) => l.sourceId);
    expect(ids).toEqual(['191630983', '191701234']);
  });

  it('parses year + km + fuel + transmission from description text', () => {
    const [tiguan, octavia] = parseListingsPage(FIXTURE);
    expect(tiguan?.year).toBe(2022);
    expect(tiguan?.mileageKm).toBe(95000);
    expect(tiguan?.fuel).toBe('diesel');
    expect(tiguan?.transmission).toBe('automatic');
    expect(octavia?.year).toBe(2017);
    expect(octavia?.mileageKm).toBe(165000);
    expect(octavia?.transmission).toBe('manual');
  });

  it('parses EUR price', () => {
    const [tiguan, octavia] = parseListingsPage(FIXTURE);
    expect(tiguan?.priceEur).toBe(19990);
    expect(octavia?.priceEur).toBe(7900);
  });

  it('extracts city as region with SK- prefix', () => {
    const [tiguan, octavia] = parseListingsPage(FIXTURE);
    expect(tiguan?.region).toBe('SK-Žiar nad Hronom');
    expect(octavia?.region).toBe('SK-Trnava');
  });

  it('source pageUrl uses /N/ offset pagination, page=1 has no offset', () => {
    expect(bazosSk.pageUrl({ page: 1 })).toBe('https://auto.bazos.sk/');
    expect(bazosSk.pageUrl({ page: 2 })).toBe('https://auto.bazos.sk/20/');
    expect(bazosSk.pageUrl({ page: 4 })).toBe('https://auto.bazos.sk/60/');
  });

  it('drops raw HTML from rawPayload', () => {
    const [tiguan] = parseListingsPage(FIXTURE);
    expect(tiguan?.rawPayload).toHaveProperty('capturedAt');
    expect(tiguan?.rawPayload).not.toHaveProperty('html');
  });
});
