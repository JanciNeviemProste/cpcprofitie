import { describe, expect, it } from 'vitest';
import { buildSystemPrompt, buildUserPrompt, type ListingInput } from '../prompts';

describe('buildSystemPrompt', () => {
  it('embeds the tone-specific guidance', () => {
    const formal = buildSystemPrompt('formal');
    const sales = buildSystemPrompt('sales');
    const short = buildSystemPrompt('short');
    expect(formal).toMatch(/Profesion/);
    expect(sales).toMatch(/predajn|hodnot/i);
    expect(short).toMatch(/Kr[áa]tk/i);
    expect(formal).not.toBe(sales);
  });

  it('always lists the canonical no-fluff rules', () => {
    const out = buildSystemPrompt('sales');
    expect(out).toMatch(/sloven/i);
    expect(out).toMatch(/titulok/);
    expect(out).toMatch(/klišé|TOP stav/);
  });
});

describe('buildUserPrompt', () => {
  const base: ListingInput = {
    make: 'Škoda',
    model: 'Octavia',
    year: 2019,
    mileageKm: 120000,
    tone: 'sales',
  };

  it('includes the required fields', () => {
    const out = buildUserPrompt(base);
    expect(out).toContain('Škoda');
    expect(out).toContain('Octavia');
    expect(out).toContain('2019');
    expect(out).toContain('120000 km');
  });

  it('omits optional fields that are empty', () => {
    const out = buildUserPrompt(base);
    expect(out).not.toMatch(/Palivo:/);
    expect(out).not.toMatch(/Prevodovka:/);
    expect(out).not.toMatch(/Predajná cena:/);
    expect(out).not.toMatch(/Výbava a poznámky:/);
  });

  it('includes optional fields when provided', () => {
    const out = buildUserPrompt({
      ...base,
      fuel: 'Diesel',
      transmission: 'Manuálna',
      features: 'Webasto, ťažné',
      priceEur: 14990,
    });
    expect(out).toContain('Palivo: Diesel');
    expect(out).toContain('Prevodovka: Manuálna');
    expect(out).toContain('Výbava a poznámky: Webasto, ťažné');
    expect(out).toContain('14990');
  });

  it('trims whitespace in the features field', () => {
    const out = buildUserPrompt({
      ...base,
      features: '   Servisná história, ťažné   ',
    });
    expect(out).toContain('Výbava a poznámky: Servisná história, ťažné');
    expect(out).not.toContain('   Servisná');
  });
});
