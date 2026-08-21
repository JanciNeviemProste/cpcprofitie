import { describe, expect, it } from 'vitest';
import { SK_KRAJE, displayRegion, krajByName } from '../sk-regions';

describe('displayRegion', () => {
  it('drops the internal country prefix', () => {
    expect(displayRegion('SK-Žilina')).toBe('Žilina');
    expect(displayRegion('CZ-Brno')).toBe('Brno');
  });

  it('leaves an unprefixed value alone', () => {
    expect(displayRegion('Bratislava')).toBe('Bratislava');
    expect(displayRegion(null)).toBeNull();
    expect(displayRegion('   ')).toBeNull();
  });
});

describe('SK_KRAJE patterns', () => {
  // 'SK-0%'…'SK-8%' looked like a postal-code mapping and were wrong: 080 01 is
  // Prešov while 'SK-0%' claimed Žilinský. They were assumed unreachable, but
  // 'SK-289 12 Nymburk' — a Czech town — was filed as Trnavský by 'SK-2%', and
  // 'SK-15 km od Levíc' as Bratislavský instead of Nitriansky. A kraj must only
  // ever be claimed on a place name, never on digits.
  it('claims no kraj for a region that starts with digits', () => {
    const numeric = ['SK-289 12 Nymburk', 'SK-15 km od Levíc', 'SK-955 01 Topoľčany'];
    for (const region of numeric) {
      for (const kraj of SK_KRAJE) {
        for (const pattern of kraj.patterns) {
          const rx = new RegExp(`^${pattern.replace(/%/g, '.*')}$`, 'i');
          expect(rx.test(region)).toBe(false);
        }
      }
    }
  });

  it('still resolves every kraj by its own name', () => {
    for (const kraj of SK_KRAJE) {
      expect(krajByName(kraj.name)).toBeDefined();
    }
  });
});
