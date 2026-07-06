import { describe, expect, it } from 'vitest';
import { assessHealthForTest } from '../data-quality';

// Guards the selector-drift detection thresholds — if someone loosens these,
// the autobazar.sk-style 100%-null-price regression would stop flagging.
describe('assessHealth', () => {
  it('flags a price collapse as drift', () => {
    const r = assessHealthForTest({ nullPricePct: 100, nullModelPct: 13, nullRegionPct: 82 });
    expect(r.health).toBe('drift');
    expect(r.healthReason).toMatch(/cena/);
  });

  it('flags a model collapse as drift', () => {
    const r = assessHealthForTest({ nullPricePct: 8, nullModelPct: 80, nullRegionPct: 8 });
    expect(r.health).toBe('drift');
    expect(r.healthReason).toMatch(/model/);
  });

  it('warns on elevated-but-not-catastrophic gaps', () => {
    const r = assessHealthForTest({ nullPricePct: 32, nullModelPct: 49, nullRegionPct: 62 });
    expect(r.health).toBe('warn');
  });

  it('is ok for a healthy source', () => {
    const r = assessHealthForTest({ nullPricePct: 8, nullModelPct: 13, nullRegionPct: 8 });
    expect(r.health).toBe('ok');
    expect(r.healthReason).toBeNull();
  });
});
