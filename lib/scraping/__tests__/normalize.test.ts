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
      modelSlug: 'skoda-octavia',
    });
    expect(parseMakeModel(null)).toEqual({ makeSlug: null, modelSlug: null });
  });
});
