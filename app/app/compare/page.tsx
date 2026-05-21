import Link from 'next/link';
import { formatEur, formatNumber } from '@/components/app/kpi-card';
import { getModelKpi, getTrendingModels } from '@/lib/db/queries/dashboard';

export const metadata = { title: 'Porovnanie' };
export const dynamic = 'force-dynamic';

type Search = { left?: string; right?: string };

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const trending = await getTrendingModels(20);
  const fallback1 = trending[0]?.modelSlug ?? '';
  const fallback2 = trending[1]?.modelSlug ?? '';
  const leftSlug = sp.left ?? fallback1;
  const rightSlug = sp.right ?? fallback2;
  const [left, right] = await Promise.all([
    leftSlug ? getModelKpi(leftSlug) : null,
    rightSlug ? getModelKpi(rightSlug) : null,
  ]);

  return (
    <div className="container mx-auto px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Porovnanie</h1>
        <p className="text-muted-foreground text-sm">
          Head-to-head dvoch modelov. Zmeňte ?left=&amp;right=&hellip; v URL pre iné páry.
        </p>
      </div>

      {!left && !right ? (
        <div className="mt-8 border-border/40 rounded-xl border p-12 text-center">
          <p className="text-muted-foreground text-sm">
            Zatiaľ žiadne klasifikované modely. Backfill model_id beží.
          </p>
        </div>
      ) : (
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <ModelColumn kpi={left} side="L" otherKpi={right} />
          <ModelColumn kpi={right} side="R" otherKpi={left} />
        </div>
      )}
    </div>
  );
}

import type { ModelKpi } from '@/lib/db/queries/dashboard';

function ModelColumn({
  kpi,
  side,
  otherKpi,
}: {
  kpi: ModelKpi | null;
  side: 'L' | 'R';
  otherKpi: ModelKpi | null;
}) {
  if (!kpi) {
    return (
      <div className="border-border/40 bg-card/30 rounded-xl border p-6">
        <p className="text-muted-foreground text-sm">Model nenájdený. Zadajte iný slug v URL.</p>
      </div>
    );
  }
  const better = (a: number | null, b: number | null, lowerIsBetter: boolean) => {
    if (a == null || b == null) return false;
    return lowerIsBetter ? a < b : a > b;
  };
  const isWinner = {
    median: better(kpi.median, otherKpi?.median ?? null, true),
    count: better(kpi.countActive, otherKpi?.countActive ?? null, false),
  };

  return (
    <div className="border-border/40 bg-card/30 rounded-xl border p-6">
      <h2 className="text-2xl font-semibold tracking-tight">{kpi.modelName}</h2>
      <div className="mt-6 grid gap-3">
        <Stat
          label="Medián ceny"
          value={kpi.median != null ? formatEur(kpi.median) : '—'}
          highlight={isWinner.median}
          hint={isWinner.median ? 'lacnejší' : undefined}
        />
        <Stat
          label="P25 / P75"
          value={
            kpi.p25 != null && kpi.p75 != null
              ? `${formatEur(kpi.p25)} – ${formatEur(kpi.p75)}`
              : '—'
          }
        />
        <Stat
          label="Aktívne inzeráty"
          value={formatNumber(kpi.countActive)}
          highlight={isWinner.count}
          hint={isWinner.count ? 'väčšia likvidita' : undefined}
        />
        <Stat label="Priemerný rok" value={kpi.avgYear != null ? String(kpi.avgYear) : '—'} />
        <Stat
          label="Priemerný počet km"
          value={kpi.avgMileageKm != null ? `${formatNumber(kpi.avgMileageKm)} km` : '—'}
        />
      </div>
      <Link
        href={`/app/analysis/${kpi.slug}`}
        className="text-primary mt-6 inline-block text-sm hover:underline"
      >
        Detail modelu →
      </Link>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  highlight,
}: {
  label: string;
  value: string;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
        highlight ? 'border-primary/40 bg-primary/5' : 'border-border/40 bg-background/30'
      }`}
    >
      <span className="text-muted-foreground text-sm">{label}</span>
      <div className="text-right">
        <p className="text-base font-semibold tabular-nums">{value}</p>
        {hint && <p className="text-primary text-xs">{hint}</p>}
      </div>
    </div>
  );
}
