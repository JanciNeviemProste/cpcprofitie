import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  autobazarEu,
  BRAND_MODEL_BUCKETS,
  parseListingsPage,
  resolveCountry,
  resolveRegionName,
} from '../autobazar-eu';

const FIXTURE = readFileSync(
  fileURLToPath(new URL('../__fixtures__/autobazar-eu-listing.html', import.meta.url)),
  'utf8',
);

describe('autobazar.eu parseListingsPage', () => {
  it('extracts listings from __NEXT_DATA__ JSON', () => {
    const listings = parseListingsPage(FIXTURE);
    expect(listings.length).toBeGreaterThanOrEqual(2);
  });

  it('uses the alphaId field as sourceId', () => {
    const [first] = parseListingsPage(FIXTURE);
    expect(first?.sourceId).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(first?.sourceId.length).toBeGreaterThan(5);
  });

  it('produces canonical /detail/x/<id>/ URLs that redirect to slugged form', () => {
    const [first] = parseListingsPage(FIXTURE);
    expect(first?.url).toBe(`https://www.autobazar.eu/detail/x/${first?.sourceId}/`);
  });

  it('pulls price, year, mileage and fuel from JSON fields', () => {
    const [first] = parseListingsPage(FIXTURE);
    expect(first?.priceEur).toBeGreaterThan(0);
    expect(first?.year).toBeGreaterThan(1990);
    expect(first?.year).toBeLessThan(2030);
    expect(first?.mileageKm).toBeGreaterThan(0);
    expect(first?.fuel).not.toBeNull();
  });

  it('extracts brand+model slugs from brandValue/carModelValue', () => {
    const [first] = parseListingsPage(FIXTURE);
    expect(first?.makeSlug).toBeTruthy();
    expect(first?.modelSlug).toBeTruthy();
  });

  it('keeps rawPayload minimal (no raw HTML)', () => {
    const [first] = parseListingsPage(FIXTURE);
    expect(first?.rawPayload).toHaveProperty('capturedAt');
    expect(first?.rawPayload).not.toHaveProperty('html');
  });

  it('returns [] when __NEXT_DATA__ is missing', () => {
    expect(parseListingsPage('<html><body><p>no script</p></body></html>')).toEqual([]);
  });

  it('source descriptor pageUrl is valid and cycles brand+model buckets', () => {
    expect(BRAND_MODEL_BUCKETS.length).toBeGreaterThan(50);
    const url1 = autobazarEu.pageUrl({ page: 1 });
    const url2 = autobazarEu.pageUrl({ page: 2 });
    expect(() => new URL(url1)).not.toThrow();
    expect(() => new URL(url2)).not.toThrow();
    // page 1 may be a brand-only bucket (.../skoda/) and page 2 may be
    // brand+model (.../skoda/octavia/). Both shapes are valid.
    expect(url1).toMatch(
      /^https:\/\/www\.autobazar\.eu\/vysledky\/osobne-vozidla\/[a-z0-9-]+\/([a-z0-9-]+\/)?$/,
    );
    expect(url1).not.toBe(url2);
  });
});

describe('autobazar.eu — the payload moved', () => {
  const SEARCH_RECORDS = readFileSync(
    fileURLToPath(new URL('../__fixtures__/autobazar-eu-listing-searchrecords.html', import.meta.url)),
    'utf8',
  );

  it('reads listings from pageProps.searchRecords', () => {
    // Real page captured on 2026-08-20, the day trpcState.queries went empty
    // and the results moved. Every list page parsed to zero that day while
    // still returning HTTP 200, so the scrape reported success and the largest
    // source silently went dark.
    const rows = parseListingsPage(SEARCH_RECORDS);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]!.sourceId).toBeTruthy();
  });

  it('still reads the older trpcState shape', () => {
    // Both paths stay supported: a site that has moved its payload once will
    // move it again, and falling back is cheaper than going blind.
    expect(parseListingsPage(FIXTURE).length).toBeGreaterThan(0);
  });
});

// Every shape below was observed live on autobazar.eu, not invented. The depth
// of parentNames varies with how precisely the advert is placed, which is why
// both helpers index from the end rather than from a fixed position.
const ZILINA = {
  id: '100011403',
  name: 'Žilina',
  parentNames: ['okres Žilina', 'Žilinský kraj', 'Slovensko'],
  parents: ['100001042', '100000105', '100000000'],
  defaultLang: 'sk',
};
const BRATISLAVA = {
  // Non-numeric node id, observed live. A "starts with 1" rule on location.id
  // reads this as unknown; the country still has to resolve from `parents`.
  id: '0_i9128BtwC-IGpZQrnK',
  name: 'Bratislava',
  parentNames: ['Bratislavský kraj', 'Slovensko'],
  parents: ['100000101', '100000000'],
  defaultLang: 'sk',
};
const NITRIANSKY = {
  id: '100000104',
  name: 'Nitriansky kraj',
  parentNames: ['Slovensko'],
  parents: ['100000000'],
  defaultLang: 'sk',
};
const SLOVENSKO = { id: '100000000', name: 'Slovensko', parentNames: [], parents: [], defaultLang: 'sk' };
const OKRES_PRAHA = {
  id: '200000200',
  name: 'okres Praha',
  parentNames: ['Hlavní město Praha', 'Česká republika'],
  parents: ['200000200', '200000000'],
  defaultLang: 'cs',
};
const VYSOCINA = {
  id: '200000610',
  name: 'Vysočina kraj',
  parentNames: ['Česká republika'],
  parents: ['200000000'],
  defaultLang: 'cs',
};

describe('resolveCountry', () => {
  it('reads the country from the last ancestor, not the node id', () => {
    expect(resolveCountry(ZILINA)).toBe('SK');
    expect(resolveCountry(OKRES_PRAHA)).toBe('CZ');
  });

  it('resolves a node whose own id is not numeric', () => {
    expect(resolveCountry(BRATISLAVA)).toBe('SK');
  });

  it('falls back to the node id when it is itself the country', () => {
    expect(resolveCountry(SLOVENSKO)).toBe('SK');
  });

  it('returns null rather than guessing for an unknown country', () => {
    // Hungary and Austria really do appear on this portal.
    expect(
      resolveCountry({ name: 'Győr', parentNames: ['Magyarország'], parents: ['400000000'] }),
    ).toBeNull();
    expect(resolveCountry(null)).toBeNull();
    expect(resolveCountry({ name: 'Nowhere' })).toBeNull();
  });

  it('returns null when the language contradicts the root id', () => {
    // A disagreement means the id map has gone stale. Failing closed keeps a
    // mislabelled car out of the reference; guessing puts it in.
    expect(resolveCountry({ ...ZILINA, defaultLang: 'cs' })).toBeNull();
  });
});

describe('resolveRegionName', () => {
  it('takes the second-to-last ancestor at every observed depth', () => {
    expect(resolveRegionName(ZILINA)).toBe('Žilinský kraj');
    expect(resolveRegionName(BRATISLAVA)).toBe('Bratislavský kraj');
    expect(resolveRegionName(OKRES_PRAHA)).toBe('Hlavní město Praha');
  });

  it('uses the node itself when the country is its only ancestor', () => {
    expect(resolveRegionName(NITRIANSKY)).toBe('Nitriansky kraj');
    expect(resolveRegionName(VYSOCINA)).toBe('Vysočina kraj');
  });

  it('rejects a country node — "Slovensko" is not a region', () => {
    expect(resolveRegionName(SLOVENSKO)).toBeNull();
  });
});

/** Minimal page in the shape parseListingsPage reads. */
function pageWith(rows: unknown[]): string {
  const payload = JSON.stringify({ props: { pageProps: { searchRecords: { data: rows } } } });
  return `<html><body><script id="__NEXT_DATA__" type="application/json">${payload}</script></body></html>`;
}

describe('autobazar.eu price currency', () => {
  const czBase = {
    id: 'cz1',
    title: 'Skoda Octavia',
    brandValue: 'Skoda',
    carModelValue: 'Octavia',
    location: OKRES_PRAHA,
  };

  it('takes finalPrice, not the CZK price, on a Czech advert', () => {
    // Observed live: price 39 900 CZK alongside finalPrice 1 642.38 EUR.
    const [row] = parseListingsPage(pageWith([{ ...czBase, price: 39900, finalPrice: 1642.38 }]));
    expect(row?.priceEur).toBe(1642.38);
    expect(row?.country).toBe('CZ');
  });

  it('yields no price rather than a CZK one when finalPrice is missing', () => {
    // 39 900 CZK is ~1 640 EUR but sails through PRICE_MAX as if it were euros,
    // so the only safe answer here is null.
    const [row] = parseListingsPage(pageWith([{ ...czBase, price: 39900 }]));
    expect(row?.priceEur).toBeNull();
  });

  it('still falls back to price on a Slovak advert', () => {
    const [row] = parseListingsPage(
      pageWith([{ ...czBase, id: 'sk1', location: ZILINA, price: 12500 }]),
    );
    expect(row?.priceEur).toBe(12500);
    expect(row?.country).toBe('SK');
  });

  it('does not fall back when the country is unknown', () => {
    const [row] = parseListingsPage(
      pageWith([{ ...czBase, id: 'hu1', location: { name: 'Győr', parents: ['400000000'] }, price: 4500000 }]),
    );
    expect(row?.priceEur).toBeNull();
    expect(row?.country).toBeNull();
  });
});
