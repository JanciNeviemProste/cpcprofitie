import { describe, expect, it } from 'vitest';
import {
  canAddGarageEntry,
  canCreateWatchlist,
  canGenerateAiListing,
  canRunAnalysis,
} from '../quota';

describe('canGenerateAiListing', () => {
  it('blocks once the monthly limit is reached', () => {
    expect(canGenerateAiListing('free', 0)).toEqual({ ok: true, remaining: 3 });
    expect(canGenerateAiListing('free', 2)).toEqual({ ok: true, remaining: 1 });
    expect(canGenerateAiListing('free', 3)).toEqual({
      ok: false,
      reason: 'plan_limit',
      limit: 3,
    });
  });

  it('treats negative limit as unlimited', () => {
    expect(canGenerateAiListing('premium', 9999)).toEqual({
      ok: true,
      remaining: 'unlimited',
    });
  });
});

describe('quota helpers respect plan ladder', () => {
  it('plus has 5 watchlist slots; premium is unlimited', () => {
    expect(canCreateWatchlist('plus', 4).ok).toBe(true);
    expect(canCreateWatchlist('plus', 5).ok).toBe(false);
    expect(canCreateWatchlist('premium', 100).ok).toBe(true);
  });

  it('garage and analyses follow the same shape', () => {
    expect(canAddGarageEntry('free', 3).ok).toBe(false);
    expect(canAddGarageEntry('plus', 19).ok).toBe(true);
    expect(canRunAnalysis('plus', 9999).ok).toBe(true);
  });
});
