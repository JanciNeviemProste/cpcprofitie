import { describe, expect, it } from 'vitest';
import {
  assessHealthForTest,
  computeRepostPct,
  pickDriftAlerts,
  type DataQualityReport,
} from '../data-quality';

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

function report(
  completeness: Array<{ source: string; health: 'ok' | 'warn' | 'drift'; healthReason: string | null }>,
): DataQualityReport {
  return {
    generatedAt: '2026-07-06T00:00:00.000Z',
    // Only the fields pickDriftAlerts reads matter; cast the rest.
    completeness: completeness.map((c) => ({ ...c }) as never),
    enrichment: [],
    dealScore: { activeCanonical: 0, flipRows: 0, withDealScore: 0, avgCohortSize: null },
    dedup: {
      total: 0,
      canonical: 0,
      repostClones: 0,
      repostPct: 0,
      vinCoveragePct: 0,
      maxClusterSize: 0,
      crossSourceVinClusters: 0,
    },
  };
}

describe('pickDriftAlerts', () => {
  it('returns only non-ok sources with a reason', () => {
    const alerts = pickDriftAlerts(
      report([
        { source: 'autobazar.sk', health: 'drift', healthReason: 'cena chýba 100%' },
        { source: 'bazos.sk', health: 'warn', healthReason: 'zvýšená chýbovosť' },
        { source: 'autobazar.eu', health: 'ok', healthReason: null },
      ]),
    );
    expect(alerts).toHaveLength(2);
    expect(alerts.map((a) => a.source)).toEqual(['autobazar.sk', 'bazos.sk']);
    expect(alerts[0]!.reason).toContain('cena');
  });

  it('is empty when everything is ok', () => {
    expect(
      pickDriftAlerts(report([{ source: 'x', health: 'ok', healthReason: null }])),
    ).toEqual([]);
  });
});

describe('computeRepostPct', () => {
  it('is the clone share of the whole corpus, one decimal', () => {
    expect(computeRepostPct(250, 1000)).toBe(25);
    expect(computeRepostPct(1, 3)).toBe(33.3);
  });

  it('is 0 for an empty corpus (no divide-by-zero)', () => {
    expect(computeRepostPct(0, 0)).toBe(0);
  });
});
