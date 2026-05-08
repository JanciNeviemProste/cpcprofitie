import { notFound } from 'next/navigation';
import { KpiCard, formatEur, formatNumber, formatPct } from '@/components/app/kpi-card';
import { ListingsTable } from '@/components/app/listings-table';
import { PriceDistributionChart } from '@/components/app/price-distribution-chart';
import { PriceTrendChart } from '@/components/app/price-trend-chart';
import {
  findModel,
  mockDistribution,
  mockListings,
  mockMarketKpi,
  mockTimeSeries,
} from '@/lib/mock';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const model = findModel(slug);
  return {
    title: model ? `${model.make} ${model.name}` : 'Analýza modelu',
  };
}

export default async function AnalysisPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const model = findModel(slug);
  if (!model) notFound();

  const kpi = mockMarketKpi(slug);
  const series = mockTimeSeries(slug);
  const distribution = mockDistribution(slug);
  const listings = mockListings(slug);
  const trend: 'up' | 'down' | 'flat' =
    kpi.weeklyChangePct > 0.5 ? 'up' : kpi.weeklyChangePct < -0.5 ? 'down' : 'flat';

  return (
    <div className="container mx-auto px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-1">
        <p className="text-muted-foreground text-sm">{model.make}</p>
        <h1 className="text-3xl font-bold tracking-tight">{model.name}</h1>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Medián ceny"
          value={formatEur(kpi.median)}
          trend={trend}
          delta={`${formatPct(kpi.weeklyChangePct)} WoW`}
        />
        <KpiCard
          label="P25 / P75"
          value={`${formatEur(kpi.p25)} – ${formatEur(kpi.p75)}`}
          hint="50% inzerátov v tomto pásme"
        />
        <KpiCard
          label="Aktívne inzeráty"
          value={formatNumber(kpi.countActive)}
          hint={`${kpi.countSoldLast30d} predaných za 30 dní`}
        />
        <KpiCard
          label="Priemerná doba predaja"
          value={`${kpi.daysToSellAvg} dní`}
          hint="od založenia do zmiznutia"
        />
      </div>

      <section className="border-border/40 bg-card/30 mt-10 rounded-xl border p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight">Cenový vývoj (26 týždňov)</h2>
          <span className="text-muted-foreground text-xs">medián, p25–p75 pásmo</span>
        </div>
        <div className="mt-4">
          <PriceTrendChart data={series} />
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="border-border/40 bg-card/30 rounded-xl border p-6">
          <h2 className="text-base font-semibold tracking-tight">Cenová distribúcia</h2>
          <p className="text-muted-foreground text-xs">
            Histogram všetkých aktívnych inzerátov
          </p>
          <div className="mt-4">
            <PriceDistributionChart data={distribution} />
          </div>
        </div>
        <div className="border-primary/30 from-primary/10 rounded-xl border bg-gradient-to-br to-transparent p-6">
          <h2 className="text-base font-semibold tracking-tight">AI Insight</h2>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed">
            <li>
              <strong className="text-foreground">Optimálna cenová pozícia:</strong>{' '}
              {formatEur(Math.round(kpi.median * 0.96))} –{' '}
              {formatEur(Math.round(kpi.median * 1.02))} (najrýchlejší predaj).
            </li>
            <li>
              <strong className="text-foreground">Najlikvidnejší región:</strong> Bratislavský — o
              23 % rýchlejší obrat než priemer.
            </li>
            <li>
              <strong className="text-foreground">Konkurencia:</strong> {kpi.countActive} aktívnych
              inzerátov, z toho {Math.round(kpi.countActive * 0.18)} pod p25 (potenciálne
              podhodnotené).
            </li>
          </ul>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-base font-semibold tracking-tight">Podobné inzeráty na trhu</h2>
        <p className="text-muted-foreground text-xs">
          Zoradené pre referenciu pri ocenení skladového kusa
        </p>
        <div className="mt-4">
          <ListingsTable listings={listings} />
        </div>
      </section>
    </div>
  );
}
