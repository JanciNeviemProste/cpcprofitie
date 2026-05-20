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
    expect(ids).toEqual(['191942373', '191701234']);
  });

  it('extracts title from h2.nadpis (not the thumbnail anchor)', () => {
    const [bmw, octavia] = parseListingsPage(FIXTURE);
    expect(bmw?.rawTitle).toBe('BMW X3, 3.0D 195KW X-DRIVE, Automat, Odpočet DPH');
    expect(octavia?.rawTitle).toBe('Škoda Octavia 1.9 TDI');
  });

  it('parses car year from popis (ignoring post-date 2026)', () => {
    const [bmw, octavia] = parseListingsPage(FIXTURE);
    expect(bmw?.year).toBe(2018);
    expect(octavia?.year).toBe(2017);
  });

  it('parses mileage from popis', () => {
    const [bmw, octavia] = parseListingsPage(FIXTURE);
    expect(bmw?.mileageKm).toBe(139730);
    expect(octavia?.mileageKm).toBe(165000);
  });

  it('parses fuel + transmission from popis', () => {
    const [bmw, octavia] = parseListingsPage(FIXTURE);
    expect(bmw?.fuel).toBe('diesel');
    expect(bmw?.transmission).toBe('automatic');
    expect(octavia?.fuel).toBe('diesel');
    expect(octavia?.transmission).toBe('manual');
  });

  it('parses EUR price from .inzeratycena', () => {
    const [bmw, octavia] = parseListingsPage(FIXTURE);
    expect(bmw?.priceEur).toBe(26990);
    expect(octavia?.priceEur).toBe(7900);
  });

  it('leaves region null (bazos list-page has no location)', () => {
    const [bmw, octavia] = parseListingsPage(FIXTURE);
    expect(bmw?.region).toBeNull();
    expect(octavia?.region).toBeNull();
  });

  it('captures thumbnail url in rawPayload', () => {
    const [bmw] = parseListingsPage(FIXTURE);
    expect(bmw?.rawPayload).toMatchObject({
      thumbnailUrl: 'https://www.bazos.sk/img/1t/373/191942373.jpg?t=1779301365',
    });
  });

  it('source pageUrl uses /N/ offset pagination, page=1 has no offset', () => {
    expect(bazosSk.pageUrl({ page: 1 })).toBe('https://auto.bazos.sk/');
    expect(bazosSk.pageUrl({ page: 2 })).toBe('https://auto.bazos.sk/20/');
    expect(bazosSk.pageUrl({ page: 4 })).toBe('https://auto.bazos.sk/60/');
  });

  it('does not leak raw HTML into rawPayload', () => {
    const [bmw] = parseListingsPage(FIXTURE);
    expect(bmw?.rawPayload).toHaveProperty('capturedAt');
    expect(bmw?.rawPayload).not.toHaveProperty('html');
  });
});
