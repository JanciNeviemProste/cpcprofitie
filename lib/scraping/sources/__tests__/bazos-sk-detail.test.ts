import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseDetailPage } from '../bazos-sk-detail';
import type { NormalizedListing } from '../../types';

const FIXTURE = readFileSync(
  fileURLToPath(new URL('../__fixtures__/bazos-sk-detail.html', import.meta.url)),
  'utf8',
);

// A legacy title-less/model-less stub: this is exactly the ~18k bazos rows the
// detail backfill targets — no makeSlug/modelSlug/rawTitle to start with.
const STUB_LISTING: NormalizedListing = {
  source: 'bazos.sk',
  sourceId: '193430711',
  url: 'https://auto.bazos.sk/inzerat/193430711/ford-kuga.php',
  makeSlug: null,
  modelSlug: null,
  priceEur: 15490,
  year: null,
  mileageKm: null,
  fuel: null,
  transmission: null,
  region: null,
  rawTitle: null,
  rawPayload: { capturedAt: '2026-05-12T05:20:06.000Z' },
};

describe('bazos.sk parseDetailPage', () => {
  it('recovers make/model/title identity for stub backfill', () => {
    // Same parseMakeModel the list parser uses, so a detail-backfilled model_id
    // lands on the exact vehicle_models row a list scrape would produce.
    const d = parseDetailPage(FIXTURE, STUB_LISTING);
    expect(d.identity?.makeSlug).toBe('ford');
    expect(d.identity?.modelSlug).toBe('kuga');
    expect(d.identity?.rawTitle).toMatch(/Ford Kuga/i);
  });

  it('extracts id-filtered photos from the CDN', () => {
    const d = parseDetailPage(FIXTURE, STUB_LISTING);
    expect(d.photos.length).toBeGreaterThan(0);
    expect(d.photos.every((p) => p.includes('193430711'))).toBe(true);
  });

  it('reads VIN and patches NULL year/mileage/region via overrides', () => {
    const d = parseDetailPage(FIXTURE, STUB_LISTING);
    expect(d.vin).toMatch(/^[A-HJ-NPR-Z0-9]{17}$/);
    expect(d.listingOverrides?.year).toBe(2020);
    expect(d.listingOverrides?.mileageKm).toBe(120000);
    expect(d.listingOverrides?.region).toMatch(/Tren/i);
  });

  it('recovers price from .inzeratycena, not a related-listing € span', () => {
    // Drains the ~8k legacy price-null stubs. The fixture has a sidebar listing
    // priced 33 000 € after the car's own 15 490 € — anchoring on .inzeratycena
    // .first() must pick THIS car's price, never the neighbour's.
    const d = parseDetailPage(FIXTURE, STUB_LISTING);
    expect(d.listingOverrides?.priceEur).toBe(15490);
  });

  it('leaves price unset when there is no price element', () => {
    const noPrice = '<html><body><h1>Ford Kuga</h1></body></html>';
    const d = parseDetailPage(noPrice, STUB_LISTING);
    expect(d.listingOverrides?.priceEur).toBeUndefined();
  });

  it('returns no identity when the title is missing', () => {
    const d = parseDetailPage('<html><body></body></html>', STUB_LISTING);
    expect(d.identity).toBeUndefined();
    expect(d.photos).toEqual([]);
    expect(d.vin).toBeNull();
  });
});

// ── Dealer-written headers ───────────────────────────────────────────────────
// Only a minority of ads use Bazoš's own "Rok výroby:" field; dealers write
// their own. Both fixtures are real pages captured 2026-08-19, and both also
// carry a *neighbouring* listing's labels in the page body — which is how a
// body-wide lookup used to assign another car's year to this one.

const DEALER_RV = readFileSync(
  fileURLToPath(new URL('../__fixtures__/bazos-sk-detail-dealer-rv.html', import.meta.url)),
  'utf8',
);
const DEALER_EVIDENCIA = readFileSync(
  fileURLToPath(new URL('../__fixtures__/bazos-sk-detail-dealer-evidencia.html', import.meta.url)),
  'utf8',
);

function stub(sourceId: string, url: string): NormalizedListing {
  return {
    ...STUB_LISTING,
    sourceId,
    url,
    priceEur: null,
    year: null,
    mileageKm: null,
  };
}

describe('bazos.sk detail — dealer-written headers', () => {
  it('reads "r.v.: 01/2018" and does not take the sidebar\'s "Rok výroby: 7/2021"', () => {
    const d = parseDetailPage(
      DEALER_RV,
      stub('194711273', 'https://auto.bazos.sk/inzerat/194711273/toyota-c-hr-18-hybrid.php'),
    );
    expect(d.listingOverrides?.year).toBe(2018);
  });

  it('prefers first registration over the marketing MODEL year', () => {
    // The page says both "MODEL 2020" and "Prvá evidencia 11/2019".
    const d = parseDetailPage(
      DEALER_EVIDENCIA,
      stub(
        '194708206',
        'https://auto.bazos.sk/inzerat/194708206/ford-focus-kombi-15-tdci-ecoblue-active-at.php',
      ),
    );
    expect(d.listingOverrides?.year).toBe(2019);
  });

  it('reads an odometer written with a dot as the thousands mark', () => {
    // "NAJAZDENÉ 203.336KM" — the separator is thousands, never a decimal.
    const d = parseDetailPage(
      DEALER_EVIDENCIA,
      stub(
        '194708206',
        'https://auto.bazos.sk/inzerat/194708206/ford-focus-kombi-15-tdci-ecoblue-active-at.php',
      ),
    );
    expect(d.listingOverrides?.mileageKm).toBe(203336);
  });

  it('ignores fuel-consumption figures when falling back to an unlabelled odometer', () => {
    // Both pages contain "…/100 km" style numbers; none may become mileage.
    for (const html of [DEALER_RV, DEALER_EVIDENCIA]) {
      const km = parseDetailPage(html, stub('x', 'https://auto.bazos.sk/inzerat/x/y.php'))
        .listingOverrides?.mileageKm;
      expect(km == null || km >= 1000).toBe(true);
    }
  });
});

describe('bazos.sk detail — labels that run into prose', () => {
  // Real failure, listing 194634446: the description read "Karoséria aj interiér
  // sú vzhľadom na vek vozidla vo veľmi peknom a zachovalom stave." The label
  // lookup returned that whole sentence — 73 characters into a varchar(32) — the
  // insert failed, and the listing's entire detail row was lost. Every write in
  // the sampled production logs failed this way.
  const PROSE = `
    <html><body><div class="popisdetail">
      Predám VW Sharan LIFE 2.0 TDI 130 kW DSG.
      Karoséria aj interiér sú vzhľadom na vek vozidla vo veľmi peknom a zachovalom stave.
      Farba je metalíza s prelakovaným pravým predným blatníkom po drobnom oděru z parkoviska.
      Prvá evidencia 08/2013
      Najazdené 226 000 km
    </div></body></html>`;

  function parse() {
    return parseDetailPage(PROSE, stub('194634446', 'https://auto.bazos.sk/inzerat/194634446/x.php'));
  }

  it('drops an over-long body type instead of storing a clipped sentence', () => {
    expect(parse().bodyType).toBeNull();
  });

  it('drops an over-long colour the same way', () => {
    expect(parse().colorExterior).toBeNull();
  });

  it('still reads the values that are genuinely short', () => {
    const d = parse();
    expect(d.listingOverrides?.year).toBe(2013);
    expect(d.listingOverrides?.mileageKm).toBe(226000);
  });
});

// Regression: Bazoš mostly writes the year two digits — "r.v.: 12/22" — and the
// parser only understood four, so 4 779 cars sat with no year and stayed out of
// every cohort. The same string carries engine displacement, and 1968, 1984 and
// 2000 all look like plausible years, so getting the order wrong would file
// cars under the wrong decade instead of failing visibly.
describe('bazos.sk detail — two-digit year', () => {
  function parse(label: string) {
    const html = `<html><body><div class="popisdetail">${label}</div></body></html>`;
    return parseDetailPage(html, stub('1', 'https://auto.bazos.sk/inzerat/1/x.php'))
      .listingOverrides?.year;
  }

  it('reads MM/YY', () => {
    expect(parse('r.v.: 12/22')).toBe(2022);
    expect(parse('r.v.: 3/19')).toBe(2019);
  });

  it('reads a nineties car as 19xx, not 20xx', () => {
    expect(parse('r.v.: 05/98')).toBe(1998);
  });

  it('does not mistake engine displacement for the year', () => {
    // The real string that exposed this: displacement follows the year.
    expect(parse('r.v.: 12/22, 1968cm³, 110kW (150PS), Automat')).toBe(2022);
    // And on its own, displacement must not become a year at all.
    expect(parse('Objem: 1984cm³')).toBeUndefined();
    expect(parse('Objem: 2000cm³')).toBeUndefined();
  });

  it('still reads the four-digit forms', () => {
    expect(parse('Rok výroby: 10/2018')).toBe(2018);
    expect(parse('MODEL 2020')).toBe(2020);
  });

  it('rejects an impossible month rather than guessing', () => {
    expect(parse('r.v.: 19/22')).toBeUndefined();
  });
});

// Every string below is copied from a real listing that had no year in the
// database. The formats are not variants of one pattern — sellers write the
// year first, the month first, a full date, or no separator at all — so each
// needs its own branch and each branch needs a case that would catch it
// swallowing the neighbouring number instead.
describe('bazos.sk detail — the year formats sellers actually write', () => {
  function parse(text: string) {
    const html = `<html><body><div class="popisdetail">${text}</div></body></html>`;
    return parseDetailPage(html, stub('1', 'https://auto.bazos.sk/inzerat/1/x.php'))
      .listingOverrides?.year;
  }

  it('reads a year-first pair', () => {
    expect(parse('r.v 2022/4 s nájazdom 157800km')).toBe(2022);
    expect(parse('✅️r.v: 2023/3')).toBe(2023);
  });

  it('reads a full registration date', () => {
    expect(parse('✅Rok výroby: 5.2.2021')).toBe(2021);
    expect(parse('✅Rok výroby:18.1.2023')).toBe(2023);
    expect(parse('✅Rok výroby: 29.3.2023')).toBe(2023);
  });

  it('reads a label with nothing between it and the value', () => {
    expect(parse('DSG automat 7st.,r.v11/2022, Diesel')).toBe(2022);
  });

  it('reads a registration label', () => {
    expect(parse('✅️PRVÁ registrácia 06/2024, ✅️NÁJAZD 147 765 km.')).toBe(2024);
  });

  it('takes the year from a date, never the day or month', () => {
    // 5.2.2021 must not read as 2005 via the day, nor 1.2023 as anything but
    // 2023 — a date whose parts are all plausible is where an ordering slip
    // would go unnoticed.
    expect(parse('Rok výroby: 12.11.1998')).toBe(1998);
  });

  it('falls back to the bare year when the date is malformed', () => {
    // Month 20 does not exist, so the date branch declines and the catch-all
    // takes the only four-digit number present. Still 2021 — refusing to read
    // the date must not cost us the year that is plainly there.
    expect(parse('Rok výroby: 5.20.2021')).toBe(2021);
  });
});
