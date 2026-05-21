import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { KpiCard, formatEur, formatNumber } from '@/components/app/kpi-card';
import { getCurrentUser } from '@/lib/auth/server';
import { getTrendingModels } from '@/lib/db/queries/dashboard';

export const metadata = { title: 'Prehľad' };
export const dynamic = 'force-dynamic';

export default async function OverviewPage() {
  const user = await getCurrentUser();
  const trending = await getTrendingModels(50);
  const top10 = trending.slice(0, 10);
  const totalActive = trending.reduce((s, t) => s + t.countActive, 0);
  const mediansForAvg = trending.map((t) => t.median).filter((m): m is number => m != null);
  const avgMedian = mediansForAvg.length
    ? Math.round(mediansForAvg.reduce((s, m) => s + m, 0) / mediansForAvg.length)
    : null;

  return (
    <div className="container mx-auto px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Prehľad trhu</h1>
        <p className="text-muted-foreground text-sm">
          {user?.email ? `Prihlásený ako ${user.email}.` : 'Verejný náhľad.'}
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Aktívne inzeráty"
          value={formatNumber(totalActive)}
          hint={`naprieč ${trending.length} modelmi`}
        />
        <KpiCard
          label="Priemerný medián"
          value={avgMedian != null ? formatEur(avgMedian) : '—'}
          hint="cez všetky modely"
        />
        <KpiCard
          label="Modelov v DB"
          value={String(trending.length)}
          hint="s najmenej 1 aktívnym inzerátom"
        />
        <KpiCard label="AI inzeráty / mesiac" value="0 / 3" hint="Free plán" />
      </div>

      <section className="border-border/40 bg-card/30 mt-10 rounded-xl border p-6">
        <header className="flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight">Top 10 modelov</h2>
          <Link href="/app/market" className="text-primary text-xs hover:underline">
            celý trh
          </Link>
        </header>
        {top10.length === 0 ? (
          <p className="text-muted-foreground mt-4 text-sm">
            Zatiaľ žiadne klasifikované inzeráty. Po nasledujúcom scrape behu sa naplnia.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border/40">
            {top10.map((t) => (
              <li key={t.modelSlug} className="flex items-center justify-between py-3">
                <Link
                  href={`/app/analysis/${t.modelSlug}`}
                  className="hover:text-primary text-sm font-medium"
                >
                  {t.modelName}
                </Link>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-muted-foreground tabular-nums">
                    {formatNumber(t.countActive)} aktívnych
                  </span>
                  <span className="text-foreground tabular-nums font-medium">
                    {t.median != null ? formatEur(t.median) : '—'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border-primary/30 from-primary/10 mt-10 rounded-xl border bg-gradient-to-br to-transparent p-6">
        <div className="flex items-start gap-4">
          <div className="bg-primary/20 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
            <Sparkles className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold tracking-tight">Smart Insights</h2>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              Týždenné insights, flip opportunities a trendové analýzy generuje weekly-maintenance
              cron. Po prvom úspešnom behu sa tu objavia konkrétne odporúčania.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
