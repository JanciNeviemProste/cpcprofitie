import { describe, expect, it } from 'vitest';
import { isVehicleTitle } from '../is-vehicle';

// Every title below is real. The "keeps" cases matter more than the "flags"
// ones: a wrongly flagged car leaves the market for good, and nothing
// re-examines a listing once it has been classified.
describe('isVehicleTitle', () => {
  it('flags parts that carry a brand and model', () => {
    expect(isVehicleTitle('Zadná kapota Honda CRV')).toBe(false);
    expect(isVehicleTitle('audi a6 c8 allroad naraznik predny 4k0807437h')).toBe(false);
    expect(isVehicleTitle('Čalúnenie dverí Golf 5')).toBe(false);
    expect(isVehicleTitle('Predam plechove disky na golf')).toBe(false);
    expect(isVehicleTitle('Elektróny ET 38')).toBe(false);
    expect(isVehicleTitle('Zámok bezpečnostného pásu Octavia')).toBe(false);
  });

  it('flags listings that are not a car on sale at all', () => {
    expect(isVehicleTitle('ROZPREDAM FIAT DUCATO 3.0')).toBe(false);
    expect(isVehicleTitle('Kúpim Škoda YETI 2017-2018 4x4 tdi')).toBe(false);
  });

  it('flags wheels and tyres by their size', () => {
    expect(isVehicleTitle('Letné pneumatiky yokohama 215/70R16')).toBe(false);
    expect(isVehicleTitle('275/35r22+315/30r22 zimne pneu')).toBe(false);
    expect(isVehicleTitle('5X112 R18 DIWE ALU disky BLACK COLOR')).toBe(false);
    expect(isVehicleTitle('Zimná sada Volvo XC60 - 5x108 R18 , 235/60/18')).toBe(false);
  });

  it('does not read a model code as a bolt pattern', () => {
    // "4.2 X150" matched a bare digit-x-number and cost a real car. Bolt
    // patterns are 4–6 studs on a 100–139 mm circle; nothing else counts.
    expect(isVehicleTitle('Jaguar XK 4.2 X150')).toBe(true);
    expect(isVehicleTitle('BMW X5 3.0d E70')).toBe(true);
  });

  it('does not find a rim inside a model name', () => {
    // "Trafic" folds to "trafik", which contains "rafik".
    expect(isVehicleTitle('Renault Trafic Renault Trafik')).toBe(true);
    expect(isVehicleTitle('Ráfik oceľový 15" Škoda')).toBe(false);
  });

  it('keeps cars whose titles list equipment that sounds like parts', () => {
    expect(isVehicleTitle('Alfa Romeo Stelvio Q4 A/T, Xenon, Vyhr.Volant+Sedadlá')).toBe(true);
    expect(isVehicleTitle('Škoda Octavia 1.9 tdi ,81kw,koža,cuvak,vyhrievané sedadla,')).toBe(true);
    expect(isVehicleTitle('Škoda superb 2,0 TDi dsg 2022 full led svetla')).toBe(true);
    expect(isVehicleTitle('BMW X3 xDrive20d A/T/Led/El.kufor/Virtual')).toBe(true);
    expect(isVehicleTitle('FIAT PANDA 1.3MultiJet 4x4 - KLIMA-ŤAŽNE-SEZONNE PNEU -')).toBe(true);
    expect(isVehicleTitle('Škoda Octavia 2.0 TDI motor CRMB 110kw')).toBe(true);
  });

  it('keeps cars described by their door count', () => {
    // The accepted cost: "Ľavé bočné dvere Škoda Fabia" is a part this will
    // never catch, because no door rule survives contact with these.
    expect(isVehicleTitle('BMW 118i 5-dverové')).toBe(true);
    expect(isVehicleTitle('Kia Ceed 1.4 CVVT, hatchback, 5 dverí')).toBe(true);
    expect(isVehicleTitle('Toyota Hilux 2,5 d4d 2-dver. dlha korba')).toBe(true);
    expect(isVehicleTitle('Jeep Wrangler Unlimited JK 3.6 V6, 4x4, 4‑dverový')).toBe(true);
    expect(isVehicleTitle('Ľavé bočné dvere Škoda Fabia')).toBe(true);
  });

  it('matches regardless of accents or case', () => {
    expect(isVehicleTitle('ZADNA KAPOTA HONDA CRV')).toBe(false);
    expect(isVehicleTitle('calunenie dveri golf 5')).toBe(false);
  });

  it('keeps a listing it cannot judge', () => {
    expect(isVehicleTitle(null)).toBe(true);
    expect(isVehicleTitle('')).toBe(true);
  });
});

describe('isVehicleTitle — second round of stems', () => {
  it('flags the part categories bazoš actually sells', () => {
    // A sample of 20 bazoš rows marked is_vehicle with no year, mileage or
    // model was 20 parts out of 20. These are the categories behind that.
    for (const title of [
      'Riadiaca jednotka motora Peugeot 407 2.0 HDI 5WS40167H-T',
      'Brzdové kotúče Renault,Nissan',
      'Originálne predné tlmiče MOPAR – Dodge Nitro / Jeep Cherokee',
      'Predam sériové autorádio skoda octavia 2004',
      'AUDI A4 B8 ZADNE SVETLO 8K9945093',
      'Spätné zrkadlo na Fiat Croma II',
      'Poťahy originál na Peugeot sw407',
      'Gumené autorohože+vanička do kufra',
      'Predna mriezka chrom BMW 5 G30/G31 (LCI od 2020)',
    ]) {
      expect(isVehicleTitle(title)).toBe(false);
    }
  });

  it('leaves alone the cars these stems were tempting on', () => {
    // Every title here is a real advert with a year and a mileage, and every
    // one of them killed a candidate stem: pneumatik, vyfuk, chladic,
    // svetlomet, dvere, kryt, priecnik. A refrigerated Sprinter is the vehicle,
    // a sports exhaust is a selling point, and LED headlights are equipment.
    for (const title of [
      'Honda Jazz 1.4 Comfort AT nový rozvodový remeň, 2x sada pneumatík',
      'Toyota RAV4 2.5 PHEV Dynamic + ťažné zariadenie + zimné pneumatiky',
      'Porsche Panamera 4S - športový výfuk + výbava nadštandard',
      'BMW Rad 3 M340i xDrive mHEV - RCP výfuk bez OPF',
      'Mercedes-Benz Sprinter chladící',
      'Citroën Jumper L3H2 chladící',
      'Škoda Superb Combi 2.0 TDi 150k Executive DSG, full LED svetlomety',
      'Citroën Berlingo - ZADNE DVERE DO STRAN',
      'Dodge RAM 5.7 V8 Laramie. Kryt korby',
      'Dongfeng T5 EVO + box a priečniky zdarma',
      // Still guarded from the first round.
      'BMW 118i 5-dverové',
      'Kia Ceed hatchback, 5 dverí',
      'ventilované sedadlá',
    ]) {
      expect(isVehicleTitle(title)).toBe(true);
    }
  });
});
