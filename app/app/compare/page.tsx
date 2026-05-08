import Link from 'next/link';
import { formatEur, formatNumber, formatPct } from '@/components/app/kpi-card';
import { findModel, mockMarketKpi, mockModels } from '@/lib/mock';

export const metadata = { title: 'Porovnanie' };

type Search = { left?: string; right?: string };

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const leftSlug = sp.left ?? 'skoda-octavia';
  const rightSlug = sp.right ?? 'volkswagen-passat';
  const left = findModel(leftSlug) ?? findModel('skoda-octavia')!;
  const right = findModel(rightSlug) ?? findModel('volkswagen-passat')!;
  const kpiL = mockMarketKpi(left.slug);
  const kpiR = mockMarketKpi(right.slug);

  const winners: Record<string, 'L' | 'R'> = {
    median: kpiL.median < kpiR.median ? 'L' : 'R',
    days: kpiL.daysToSellAvg < kpiR.daysToSellAvg ? 'L' : 'R',
    active: kpiL.countActive > kpiR.countActive ? 'L' : 'R',
    growth: kpiL.weeklyChangePct > kpiR.weeklyChangePct ? 'L' : 'R',
  };

  return (
    <div className="container mx-auto px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Porovnanie</h1>
        <p className="text-muted-foreground text-sm">
          Head-to-head dvoch modelov. Zmeňte ?left=&amp;right=&hellip; v URL pre iné páry.
        </p>
      </div>

      <ModelPicker selected={left.slug} param="left" otherParam="right" otherSelected={right.slug} />

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <ModelColumn slug={left.slug} winners={winners} side="L" />
        <ModelColumn slug={right.slug} winners={winners} side="R" />
      </div>
    </div>
  );
}

function ModelColumn({
  slug,
  winners,
  side,
}: {
  slug: string;
  winners: Record<string, 'L' | 'R'>;
  side: 'L' | 'R';
}) {
  const model = findModel(slug)!;
  const kpi = mockMarketKpi(slug);
  const trend: 'up' | 'down' | 'flat' =
    kpi.weeklyChangePct > 0.5 ? 'up' : kpi.weeklyChangePct < -0.5 ? 'down' : 'flat';
  const isWinner = (key: keyof typeof winners) => winners[key] === side;

  return (
    <div className="border-border/40 bg-card/30 rounded-xl border p-6">
      <p className="text-muted-foreground text-xs uppercase tracking-wider">{model.make}</p>
      <h2 className="text-2xl font-semibold tracking-tight">{model.name}</h2>
      <div className="mt-6 grid gap-3">
        <Stat
          label="Medián"
          value={formatEur(kpi.median)}
          highlight={isWinner('median')}
          hint={isWinner('median') ? 'lacnejší' : undefined}
        />
        <Stat
          label="Doba predaja"
          value={`${kpi.daysToSellAvg} dní`}
          highlight={isWinner('days')}
          hint={isWinner('days') ? 'rýchlejší obrat' : undefined}
        />
        <Stat
          label="Aktívne inzeráty"
          value={formatNumber(kpi.countActive)}
          highlight={isWinner('active')}
          hint={isWinner('active') ? 'väčšia likvidita' : undefined}
        />
        <Stat
          label="Týždenný trend"
          value={formatPct(kpi.weeklyChangePct)}
          highlight={isWinner('growth')}
          hint={isWinner('growth') ? 'lepší momentum' : undefined}
          tone={trend}
        />
      </div>
      <Link
        href={`/app/analysis/${slug}`}
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
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  highlight?: boolean;
  tone?: 'up' | 'down' | 'flat';
}) {
  const valueColor =
    tone === 'up' ? 'text-chart-3' : tone === 'down' ? 'text-destructive' : 'text-foreground';
  return (
    <div
      className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
        highlight ? 'border-primary/40 bg-primary/5' : 'border-border/40 bg-background/30'
      }`}
    >
      <span className="text-muted-foreground text-sm">{label}</span>
      <div className="text-right">
        <p className={`text-base font-semibold tabular-nums ${valueColor}`}>{value}</p>
        {hint && <p className="text-primary mt-0.5 text-xs">{hint}</p>}
      </div>
    </div>
  );
}

function ModelPicker({
  selected,
  param,
  otherParam,
  otherSelected,
}: {
  selected: string;
  param: 'left' | 'right';
  otherParam: 'left' | 'right';
  otherSelected: string;
}) {
  return (
    <div className="text-muted-foreground mt-6 flex flex-wrap items-center gap-2 text-xs">
      <span>Vyber {param === 'left' ? 'ľavý' : 'pravý'}:</span>
      {mockModels.slice(0, 6).map((m) => (
        <Link
          key={m.slug}
          href={{
            pathname: '/app/compare',
            query: { [param]: m.slug, [otherParam]: otherSelected },
          }}
          className={
            m.slug === selected
              ? 'border-primary bg-primary/10 text-primary rounded-md border px-2 py-1'
              : 'border-border/40 hover:bg-muted rounded-md border px-2 py-1'
          }
        >
          {m.make} {m.name}
        </Link>
      ))}
    </div>
  );
}
