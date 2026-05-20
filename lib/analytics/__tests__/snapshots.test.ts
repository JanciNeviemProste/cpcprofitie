import { describe, expect, it } from 'vitest';
import { isoWeekStart } from '../dates';

describe('isoWeekStart', () => {
  it('returns Monday for a Wednesday', () => {
    // Wed 2026-05-20 → Mon 2026-05-18
    const start = isoWeekStart(new Date('2026-05-20T10:30:00Z'));
    expect(start.toISOString().slice(0, 10)).toBe('2026-05-18');
  });

  it('returns the same Monday for Monday', () => {
    const start = isoWeekStart(new Date('2026-05-18T00:00:00Z'));
    expect(start.toISOString().slice(0, 10)).toBe('2026-05-18');
  });

  it('returns previous Monday for Sunday', () => {
    // Sun 2026-05-24 → Mon 2026-05-18
    const start = isoWeekStart(new Date('2026-05-24T23:59:59Z'));
    expect(start.toISOString().slice(0, 10)).toBe('2026-05-18');
  });

  it('crosses month boundary correctly', () => {
    // Fri 2026-05-01 → Mon 2026-04-27
    const start = isoWeekStart(new Date('2026-05-01T12:00:00Z'));
    expect(start.toISOString().slice(0, 10)).toBe('2026-04-27');
  });

  it('crosses year boundary correctly', () => {
    // Fri 2026-01-02 → Mon 2025-12-29
    const start = isoWeekStart(new Date('2026-01-02T12:00:00Z'));
    expect(start.toISOString().slice(0, 10)).toBe('2025-12-29');
  });

  it('returns time set to midnight UTC', () => {
    const start = isoWeekStart(new Date('2026-05-20T15:30:00Z'));
    expect(start.toISOString()).toBe('2026-05-18T00:00:00.000Z');
  });
});
