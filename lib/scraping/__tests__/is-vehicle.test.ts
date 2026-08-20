import { describe, expect, it } from 'vitest';
import { isVehicleTitle } from '../is-vehicle';

// Every title below is real, taken from listings the catalog had filed as cars.
describe('isVehicleTitle', () => {
  it('flags parts that carry a brand and model', () => {
    expect(isVehicleTitle('Ľavé bočné dvere Škoda Fabia')).toBe(false);
    expect(isVehicleTitle('Zámok bezpečnostného pásu Octavia')).toBe(false);
    expect(isVehicleTitle('Predné nárazníky Passat B6')).toBe(false);
    expect(isVehicleTitle('Čalúnenie dverí Golf 5')).toBe(false);
    expect(isVehicleTitle('Rozpredám Škoda Superb 2.0 TDI')).toBe(false);
  });

  it('flags wheels and tyres by their dimensions', () => {
    expect(isVehicleTitle('Zimné pneu 205/55 R16 Škoda')).toBe(false);
    expect(isVehicleTitle('275/35r22+315/30r22 zimne pneu')).toBe(false);
    expect(isVehicleTitle('Alu disky 5x112 Audi')).toBe(false);
  });

  it('keeps whole cars whose titles mention a part', () => {
    // "motor" is not a part word — it is in half the genuine ads.
    expect(isVehicleTitle('Škoda Octavia 2.0 TDI motor CRMB 110kw')).toBe(true);
    expect(isVehicleTitle('Volkswagen Passat Variant 110KW 2024 Ťažné Webasto HUD Masáž')).toBe(
      true,
    );
    expect(isVehicleTitle('Ford Transit 2.2 TDCI nové brzdy a tlmiče')).toBe(true);
  });

  it('reads a door count as a body style, not a door for sale', () => {
    expect(isVehicleTitle('Fiat Punto 5 dverové')).toBe(true);
    expect(isVehicleTitle('Peugeot 207 3-dverový hatchback')).toBe(true);
  });

  it('matches regardless of accents or case', () => {
    expect(isVehicleTitle('LAVE BOCNE DVERE SKODA FABIA')).toBe(false);
    expect(isVehicleTitle('calunenie dveri golf 5')).toBe(false);
  });

  it('lets a part through rather than risk a car — the accepted cost', () => {
    // "svetla" and "kufor" appear in genuine ads as equipment ("full led
    // svetla", "El.kufor"), so neither is a part word here. This boot lid
    // therefore stays classified as a car. One bad row in a cohort of
    // hundreds beats removing a real car from the market for good.
    expect(isVehicleTitle('Kufor s krídlom + zadné svetlá škoda Octavia 1')).toBe(true);
    expect(isVehicleTitle('Škoda superb 2,0 TDi dsg 2022 full led svetla')).toBe(true);
    expect(isVehicleTitle('BMW 520D + sada 4 kolies so zimnymi pneu')).toBe(true);
  });

  it('keeps a listing it cannot judge', () => {
    // A missing title is not evidence of a part, and dropping it would remove
    // a car from the market on no evidence at all.
    expect(isVehicleTitle(null)).toBe(true);
    expect(isVehicleTitle('')).toBe(true);
  });
});
