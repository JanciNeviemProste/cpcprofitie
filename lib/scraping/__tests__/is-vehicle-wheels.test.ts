import { describe, expect, it } from 'vitest';
import { isVehicleTitle } from '../is-vehicle';

// The `disky` stem was deleting real cars: a wheel diameter written onto the
// word is the last item in an equipment list, not the thing for sale. Measured
// five such cars, each over EUR 3 000 with a year, a mileage and a model.
describe('wheels named as equipment', () => {
  it('keeps a car whose title advertises its wheel size', () => {
    for (const title of [
      'Audi A5 Sportback S-Line, SR, Servis Audi, Bez investicii, 19disky',
      'BMW X3 30D XDRIVE, M-SPORT, 210KW, SK SPZ, LASER, TAZNE, 20" DISKY, WEBASTO',
      'BMW Rad 5 Touring 530D M-SPORT, XDRIVE, HARMAN/KARDON, 19" disky',
    ]) {
      expect(isVehicleTitle(title)).toBe(true);
    }
  });

  it('still flags an advert that is actually selling wheels', () => {
    for (const title of [
      'PLECH. DISKY R13 4x130 - SKODA 120, PRIVESNY VOZIK',
      'disky + letne pneu 175/65 R14',
      '4x zimne kolesa Matador Sibir Snow MP92 185/60 R15 + disky',
      'Disky Breyton',
      '153. SKODA OCTAVIA ALU DISKY 205/60 R16',
      'Hlinikove disky 5x112 R17 DBV - Audi, VW, Skoda, Seat',
      'Hlinikove disky ANZIO SPLIT 5,5x14 4x100 ET35 polar-silver',
    ]) {
      expect(isVehicleTitle(title)).toBe(false);
    }
  });
});
