import { describe, expect, it } from 'vitest';
import {
  mockDistribution,
  mockListings,
  mockMarketKpi,
  mockTimeSeries,
  mockTrending,
} from '../mock';

describe('mock data determinism (SSR/CSR safety)', () => {
  it('mockMarketKpi is stable across calls for the same slug', () => {
    const a = mockMarketKpi('skoda-octavia');
    const b = mockMarketKpi('skoda-octavia');
    expect(a).toEqual(b);
  });

  it('mockMarketKpi diverges across slugs', () => {
    const a = mockMarketKpi('skoda-octavia');
    const b = mockMarketKpi('bmw-3-320d');
    expect(a.basePrice).not.toBe(b.basePrice);
  });

  it('mockTimeSeries uses a fixed anchor (no Date.now)', () => {
    const a = mockTimeSeries('skoda-octavia');
    const b = mockTimeSeries('skoda-octavia');
    expect(a).toEqual(b);
    expect(a).toHaveLength(26);
    // Dates must be ISO yyyy-mm-dd strings
    expect(a[0]?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('mockDistribution + mockListings are deterministic', () => {
    expect(mockDistribution('audi-a4')).toEqual(mockDistribution('audi-a4'));
    expect(mockListings('audi-a4')).toEqual(mockListings('audi-a4'));
  });

  it('mockTrending always covers all curated models', () => {
    const t1 = mockTrending();
    const t2 = mockTrending();
    expect(t1).toEqual(t2);
    expect(t1.length).toBeGreaterThan(5);
    for (const item of t1) {
      expect(typeof item.modelName).toBe('string');
      expect(item.median).toBeGreaterThan(0);
    }
  });
});
