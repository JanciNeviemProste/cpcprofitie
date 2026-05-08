import Link from 'next/link';
import { ArrowDownRight, ArrowUpRight, Sparkles } from 'lucide-react';
import { KpiCard, formatEur, formatNumber, formatPct } from '@/components/app/kpi-card';
import { getCurrentUser } from '@/lib/auth/server';
import { mockTrending } from '@/lib/mock';

export const metadata = { title: 'Prehľad' };

export default async function OverviewPage() {
  const user = await getCurrentUser();
  const trending = mockTrending();
  const movers = [...trending].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
  const topGainers = movers.filter((m) => m.changePct > 0).slice(0, 3);
  const topLosers = movers.filter((m) => m.changePct < 0).slice(0, 3);

  const totalActive = trending.reduce((s, t) => s + t.countActive, 0);
  const avgMedian = Math.round(
    trending.reduce((s, t) => s + t.median, 0) / Math.max(1, trending.length),
  );

  return (
    <div className="container mx-auto px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Prehľad trhu</h1>
        <p className="text-muted-foreground text-sm">
          {user?.email ? `Prihlásený ako ${user.email}.` : 'Demo dáta — produkčné dáta po prvom scrape behu.'}
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Aktívne inzeráty"
          value={formatNumber(totalActive)}
          delta="+312 dnes"
          trend="up"
          hint="naprieč 10 sledovanými modelmi"
        />
        <KpiCard
          label="Priemerný medián"
          value={formatEur(avgMedian)}
          delta="+1.4 % WoW"
          trend="up"
        />
        <KpiCard
          label="Najrýchlejšie predávané"
          value="Škoda Octavia"
          delta="17 dní avg."
          trend="up"
          hint="medián doby na trhu"
        />
        <KpiCard
          label="AI inzeráty / mesiac"
          value="0 / 3"
          hint="Free plán"
        />
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <section className="border-border/40 bg-card/30 rounded-xl border p-6">
          <header className="flex items-center justify-between">
            <h2 className="text-base font-semibold tracking-tight">Top rastúce modely</h2>
            <Link href="/app/market" className="text-primary text-xs hover:underline">
              celý trh
            </Link>
          </header>
          <ul className="mt-4 divide-y divide-border/40">
            {topGainers.map((t) => (
              <li key={t.modelSlug} className="flex items-center justify-between py-3">
                <Link
                  href={`/app/analysis/${t.modelSlug}`}
                  className="hover:text-primary text-sm font-medium"
                >
                  {t.modelName}
                </Link>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-muted-foreground tabular-nums">
                    {formatEur(t.median)}
                  </span>
                  <span className="text-chart-3 flex items-center gap-0.5 font-medium tabular-nums">
                    <ArrowUpRight className="size-3" />
                    {formatPct(t.changePct)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-border/40 bg-card/30 rounded-xl border p-6">
          <header className="flex items-center justify-between">
            <h2 className="text-base font-semibold tracking-tight">Top klesajúce modely</h2>
            <Link href="/app/market" className="text-primary text-xs hover:underline">
              celý trh
            </Link>
          </header>
          <ul className="mt-4 divide-y divide-border/40">
            {topLosers.map((t) => (
              <li key={t.modelSlug} className="flex items-center justify-between py-3">
                <Link
                  href={`/app/analysis/${t.modelSlug}`}
                  className="hover:text-primary text-sm font-medium"
                >
                  {t.modelName}
                </Link>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-muted-foreground tabular-nums">
                    {formatEur(t.median)}
                  </span>
                  <span className="text-destructive flex items-center gap-0.5 font-medium tabular-nums">
                    <ArrowDownRight className="size-3" />
                    {formatPct(t.changePct)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="border-primary/30 from-primary/10 mt-10 rounded-xl border bg-gradient-to-br to-transparent p-6">
        <div className="flex items-start gap-4">
          <div className="bg-primary/20 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
            <Sparkles className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold tracking-tight">Smart Insight</h2>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              <strong className="text-foreground">BMW 3 Series 320d</strong> sa v Bratislavskom
              regióne predáva o <strong className="text-foreground">8 % nad medián</strong> v
              porovnaní so zvyškom Slovenska. Ak máte taký kus na sklade, zvážte cenu o 400 € nižšie
              — predáte do týždňa.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
