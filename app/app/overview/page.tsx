import { getCurrentUser } from '@/lib/auth/server';

export const metadata = { title: 'Prehľad' };

export default async function OverviewPage() {
  const user = await getCurrentUser();
  return (
    <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold tracking-tight">Vitajte v CPCProfit</h1>
        <p className="text-muted-foreground mt-2">
          {user?.email
            ? `Prihlásení ako ${user.email}.`
            : 'Dashboard placeholder — budú tu KPI karty, trending modely, anomálie a denný pulz trhu.'}
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            { label: 'Aktívne inzeráty', value: '—', hint: 'Po prvom scrape behu' },
            { label: 'Sledované modely', value: '0', hint: 'Watchlist je prázdny' },
            { label: 'AI inzeráty / mesiac', value: '0 / 3', hint: 'Free plán' },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="border-border/40 bg-card/40 rounded-xl border p-5"
            >
              <p className="text-muted-foreground text-xs">{kpi.label}</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">{kpi.value}</p>
              <p className="text-muted-foreground mt-1 text-xs">{kpi.hint}</p>
            </div>
          ))}
        </div>

        <div className="border-border/40 bg-muted/30 mt-8 rounded-xl border p-6 text-sm">
          <p className="font-medium">Ďalšie kroky implementácie</p>
          <ol className="text-muted-foreground mt-3 space-y-1 [counter-reset:steps]">
            <li>Stripe billing (Fáza 3)</li>
            <li>Scraping pipeline pre autobazar.sk (Fáza 4)</li>
            <li>Aplikačné moduly: Analýza, Porovnanie, Trh, Garáž, Watchlist (Fáza 5)</li>
            <li>AI Inzerát so streaming (Fáza 6)</li>
            <li>Polish & launch (Fáza 7)</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
