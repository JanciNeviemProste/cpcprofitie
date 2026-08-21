import { describe, expect, it } from 'vitest';
import {
  assessHealthForTest,
  computeRepostPct,
  pickClusterAlerts,
  pickDriftAlerts,
  pickCountryCoverageAlerts,
  pickFreshnessAlerts,
  toPublicDataHealth,
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
    ok: true,
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
      vinConflictClusters: 0,
      incoherentClusters: 0,
      chainedClones: 0,
    },
    freshness: [],
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

describe('toPublicDataHealth', () => {
  function full(
    ok: boolean,
    rows: Array<{ source: string; active: number; health: 'ok' | 'warn' | 'drift' }>,
    repostPct = 0,
  ): DataQualityReport {
    return {
      ok,
      generatedAt: '2026-07-07T00:00:00.000Z',
      completeness: rows.map(
        (r) =>
          ({
            source: r.source,
            active: r.active,
            health: r.health,
            healthReason: null,
            nullPricePct: 0,
            nullModelPct: 0,
            cohortReadyPct: 0,
          }) as never,
      ),
      enrichment: [],
      dealScore: { activeCanonical: 0, flipRows: 0, withDealScore: 0, avgCohortSize: null },
      dedup: {
        total: 0,
        canonical: 0,
        repostClones: 0,
        repostPct,
        vinCoveragePct: 0,
        maxClusterSize: 0,
        crossSourceVinClusters: 0,
        vinConflictClusters: 0,
        incoherentClusters: 0,
        chainedClones: 0,
      },
      freshness: [],
    };
  }

  it('overall is the worst source health', () => {
    const p = toPublicDataHealth(
      full(true, [
        { source: 'a', active: 100, health: 'ok' },
        { source: 'b', active: 200, health: 'drift' },
        { source: 'c', active: 50, health: 'warn' },
      ]),
    );
    expect(p.overall).toBe('drift');
    expect(p.totalActive).toBe(350);
    expect(p.sources).toHaveLength(3);
  });

  it('is unknown (never ok) when the report failed', () => {
    const p = toPublicDataHealth(full(false, []));
    expect(p.overall).toBe('unknown');
    expect(p.ok).toBe(false);
  });

  it('is unknown when there is no data, even if ok', () => {
    expect(toPublicDataHealth(full(true, [])).overall).toBe('unknown');
  });

  it('passes through the repost percentage', () => {
    expect(toPublicDataHealth(full(true, [{ source: 'a', active: 1, health: 'ok' }], 17.5)).repostPct).toBe(17.5);
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

describe('pickClusterAlerts', () => {
  const base = {
    ok: true as const,
    generatedAt: new Date(0).toISOString(),
    completeness: [],
    enrichment: [],
    dealScore: { activeCanonical: 0, flipRows: 0, withDealScore: 0, avgCohortSize: null },
    dedup: {
      total: 100,
      canonical: 100,
      repostClones: 0,
      repostPct: 0,
      vinCoveragePct: 0,
      maxClusterSize: 0,
      crossSourceVinClusters: 0,
      vinConflictClusters: 0,
      incoherentClusters: 0,
      chainedClones: 0,
    },
    freshness: [],
  };

  it('stays quiet when nothing contradicts itself', () => {
    expect(pickClusterAlerts(base)).toEqual([]);
  });

  it('reports a single different VIN in a cluster', () => {
    // Not a threshold: two VINs are two cars, so one is already a defect.
    const alerts = pickClusterAlerts({
      ...base,
      dedup: { ...base.dedup, vinConflictClusters: 1 },
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.count).toBe(1);
  });

  it('reports chains and incoherent clusters separately', () => {
    const alerts = pickClusterAlerts({
      ...base,
      dedup: { ...base.dedup, chainedClones: 35, incoherentClusters: 23 },
    });
    expect(alerts.map((a) => a.count)).toEqual([35, 23]);
  });

  it('does not fire on a large but coherent cluster', () => {
    // A big cluster is not by itself wrong — maxClusterSize sat at 682 on the
    // dashboard for weeks and told nobody anything. The invariants are what
    // separate "large" from "impossible".
    expect(pickClusterAlerts({ ...base, dedup: { ...base.dedup, maxClusterSize: 40 } })).toEqual([]);
  });
});

describe('pickFreshnessAlerts', () => {
  const fresh = (source: string, pctWithinSla: number) => ({
    source,
    activeCanonical: 1000,
    pctWithinSla,
    slaDays: 4,
    p50AgeHours: 20,
    p90AgeHours: 60,
    oldestAgeDays: 3,
    neverCheckedPct: 0,
  });
  const withFreshness = (rows: ReturnType<typeof fresh>[]): DataQualityReport => ({
    ...report([]),
    freshness: rows,
  });

  it('stays quiet while prices are being re-read', () => {
    expect(pickFreshnessAlerts(withFreshness([fresh('bazos.sk', 98)]))).toEqual([]);
  });

  it('warns before it is a crisis', () => {
    const a = pickFreshnessAlerts(withFreshness([fresh('bazos.sk', 90)]));
    expect(a).toHaveLength(1);
    expect(a[0]!.level).toBe('warn');
  });

  it('escalates when most prices are stale', () => {
    const a = pickFreshnessAlerts(withFreshness([fresh('autobazar.eu', 41)]));
    expect(a[0]!.level).toBe('error');
  });

  it('says nothing about a source with no listings', () => {
    // An empty source is a different problem, and reporting 0% freshness for it
    // would bury the sources that actually have prices going stale.
    expect(
      pickFreshnessAlerts(withFreshness([{ ...fresh('bazos.sk', 0), activeCanonical: 0 }])),
    ).toEqual([]);
  });

  it('judges each source on its own', () => {
    const a = pickFreshnessAlerts(
      withFreshness([fresh('bazos.sk', 99), fresh('autobazar.eu', 12)]),
    );
    expect(a).toHaveLength(1);
    expect(a[0]!.source).toBe('autobazar.eu');
  });
});

describe('pickCountryCoverageAlerts', () => {
  // The gate for tightening the market predicate from "exclude what is known
  // foreign" to "admit only confirmed Slovak". Flipping while coverage is thin
  // retires rows we know nothing bad about, so the threshold is a measured
  // number and not a feeling about how far the rotation has got.
  function withCountry(rows: Array<{ source: string; active: number; nullCountryPct: number }>) {
    return {
      ok: true,
      generatedAt: '2026-08-21T00:00:00.000Z',
      completeness: rows.map((r) => ({ ...r }) as never),
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
        vinConflictClusters: 0,
        incoherentClusters: 0,
        chainedClones: 0,
      },
      freshness: [],
    } as unknown as DataQualityReport;
  }

  it('stays silent once a source is essentially fully attributed', () => {
    const alerts = pickCountryCoverageAlerts(
      withCountry([{ source: 'bazos.sk', active: 30000, nullCountryPct: 0 }]),
    );
    expect(alerts).toEqual([]);
  });

  it('warns while the reference cannot safely be tightened', () => {
    const alerts = pickCountryCoverageAlerts(
      withCountry([{ source: 'autobazar.eu', active: 48000, nullCountryPct: 9.2 }]),
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.level).toBe('warn');
  });

  it('escalates when a fifth of a source has no market', () => {
    const alerts = pickCountryCoverageAlerts(
      withCountry([{ source: 'autobazar.eu', active: 48000, nullCountryPct: 21 }]),
    );
    expect(alerts[0]?.level).toBe('error');
  });

  it('ignores a source with nothing active', () => {
    expect(
      pickCountryCoverageAlerts(withCountry([{ source: 'x', active: 0, nullCountryPct: 100 }])),
    ).toEqual([]);
  });
});
