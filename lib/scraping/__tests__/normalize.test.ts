import { describe, expect, it } from 'vitest';
import {
  parseEur,
  parseFuel,
  parseKm,
  parseMakeModel,
  parseTransmission,
  parseYear,
  slugify,
} from '../normalize';

describe('parseEur', () => {
  it('strips Slovak number formatting', () => {
    expect(parseEur('14 990 €')).toBe(14990);
    expect(parseEur('14.990,00 EUR')).toBe(1499000);
    expect(parseEur('Cena na dotaz')).toBe(null);
    expect(parseEur(null)).toBe(null);
  });
});

describe('parseKm', () => {
  it('extracts mileage digits only', () => {
    expect(parseKm('120 000 km')).toBe(120000);
    expect(parseKm('na novo - 0')).toBe(0);
    expect(parseKm('—')).toBe(null);
  });
});

describe('parseYear', () => {
  it('returns the first plausible 4-digit year', () => {
    expect(parseYear('Rok výroby: 2019')).toBe(2019);
    expect(parseYear('1900')).toBe(null);
    expect(parseYear('Kombi 1.6 TDI 2018/05')).toBe(2018);
  });
});

describe('parseFuel + parseTransmission', () => {
  it('maps Slovak labels to canonical enum values', () => {
    expect(parseFuel('Diesel')).toBe('diesel');
    expect(parseFuel('benzín')).toBe('gasoline');
    expect(parseFuel('Elektro')).toBe('electric');
    expect(parseFuel('?')).toBe(null);
    expect(parseTransmission('automat')).toBe('automatic');
    expect(parseTransmission('Manuálna')).toBe('manual');
  });
});

describe('slugify', () => {
  it('removes diacritics and non-alphanumerics', () => {
    expect(slugify('Škoda Octavia')).toBe('skoda-octavia');
    expect(slugify('  BMW   3  Series  ')).toBe('bmw-3-series');
  });
});

describe('parseMakeModel', () => {
  it('reads make and model from the title head', () => {
    expect(parseMakeModel('Škoda Octavia 2.0 TDI Combi')).toEqual({
      makeSlug: 'skoda',
      modelSlug: 'octavia',
    });
    expect(parseMakeModel(null)).toEqual({ makeSlug: null, modelSlug: null });
  });

  // Bazoš titles are free text, and the old first-two-words rule turned them
  // into makes called `predam`, split VW across two brands, and pulled wheels
  // and door panels into the vehicle catalog.
  it('finds the brand anywhere in the title, not just at the head', () => {
    expect(parseMakeModel('Predám Škoda Octavia 2.0 TDI')).toEqual({
      makeSlug: 'skoda',
      modelSlug: 'octavia',
    });
    expect(parseMakeModel('Ľavé bočné dvere Škoda Fabia 1 strana vodiča')).toEqual({
      makeSlug: 'skoda',
      modelSlug: 'fabia',
    });
  });

  it('gives an alias and its canonical spelling the same identity', () => {
    // 1 791 VW listings were split between `vw` and `volkswagen`, halving the
    // cohort every median is computed from.
    expect(parseMakeModel('VW Golf 1.6 TDI')).toEqual(parseMakeModel('Volkswagen Golf 1.6 TDI'));
    expect(parseMakeModel('Mercedes C 220')?.makeSlug).toBe('mercedes-benz');
  });

  it('returns nothing rather than inventing a make', () => {
    // A null model is a clean unknown; an invented one poisons cohort medians.
    for (const junk of ['Kolesá', '205/55R16', 'Rozpredám golf 4 96kw', 'Sada zámku']) {
      expect(parseMakeModel(junk)).toEqual({ makeSlug: null, modelSlug: null });
    }
  });

  it('prefers the longer model name and handles two-word brands', () => {
    expect(parseMakeModel('Škoda Octavia Combi 2.0')).toEqual({
      makeSlug: 'skoda',
      modelSlug: 'octavia-combi',
    });
    expect(parseMakeModel('Land Rover Discovery 3.0')).toEqual({
      makeSlug: 'land-rover',
      modelSlug: 'discovery',
    });
  });

  it('keeps the brand when the model is unknown', () => {
    const r = parseMakeModel('Audi Q9 prototyp');
    expect(r.makeSlug).toBe('audi');
    expect(r.modelSlug).toBeNull();
  });
});
