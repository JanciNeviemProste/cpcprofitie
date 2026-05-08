import { describe, expect, it } from 'vitest';
import {
  defaultDeniedConsent,
  defaultGrantedConsent,
  parseConsent,
} from '../consent';

describe('parseConsent', () => {
  it('returns null for empty / nullable inputs', () => {
    expect(parseConsent(null)).toBeNull();
    expect(parseConsent(undefined)).toBeNull();
    expect(parseConsent('')).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(parseConsent('{not-json')).toBeNull();
    expect(parseConsent('null')).toBeNull();
    expect(parseConsent('true')).toBeNull();
  });

  it('returns null for unknown / future versions', () => {
    expect(parseConsent(JSON.stringify({ version: 2, decidedAt: new Date().toISOString() }))).toBeNull();
    expect(parseConsent(JSON.stringify({ analytics: true, decidedAt: 'now' }))).toBeNull();
  });

  it('parses a valid v1 payload and coerces booleans', () => {
    const raw = JSON.stringify({
      version: 1,
      decidedAt: '2026-05-08T00:00:00Z',
      analytics: 'truthy',
      marketing: 0,
    });
    const parsed = parseConsent(raw);
    expect(parsed).toEqual({
      version: 1,
      necessary: true,
      analytics: true,
      marketing: false,
      decidedAt: '2026-05-08T00:00:00Z',
    });
  });

  it('round-trips defaults', () => {
    expect(parseConsent(JSON.stringify(defaultDeniedConsent()))?.analytics).toBe(false);
    expect(parseConsent(JSON.stringify(defaultGrantedConsent()))?.marketing).toBe(true);
  });
});
