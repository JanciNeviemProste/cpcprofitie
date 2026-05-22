import { DealsFilters, type DealsFiltersValue } from '@/components/app/deals/filters';
import { DealCard } from '@/components/app/deals/deal-card';
import { HeroDeal } from '@/components/app/deals/hero-deal';
import { getTopDealsV2 } from '@/lib/db/queries/deals';
import type { Source } from '@/lib/scraping/types';
import { Search } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Deals 2.0 — DealScore vážené príležitosti · CPCProfit',
};

const ALL_SOURCES: ReadonlyArray<Source> = ['autobazar.sk', 'autobazar.eu', 'bazos.sk'];

function parseList(v: string | string[] | undefined): string[] {
  if (!v) return [];
  const raw = Array.isArray(v) ? v.join(',') : v;
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseNum(v: string | string[] | undefined): number | undefined {
  if (!v) return undefined;
  const raw = Array.isArray(v) ? v[0] : v;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function parseSources(v: string | string[] | undefined): Source[] {
  return parseList(v).filter((s): s is Source =>
    (ALL_SOURCES as ReadonlyArray<string>).includes(s),
  );
}

// Bento sizing — `lg` covers two columns, `md` is a single column on desktop,
// `sm` is reserved for lower-score tail items so the grid breathes naturally.
function sizeForIndex(index: number, total: number, score: number): 'lg' | 'md' | 'sm' {
  if (index < 2) return 'lg';
  if (score < 60 || index > total - 5) return 'sm';
  return 'md';
}

// 12-col bento spans — paired with sizeForIndex above.
function spanForSize(size: 'lg' | 'md' | 'sm'): string {
  if (size === 'lg') return 'sm:col-span-6 lg:col-span-6 xl:col-span-6';
  if (size === 'sm') return 'sm:col-span-6 lg:col-span-3 xl:col-span-3';
  return 'sm:col-span-6 lg:col-span-4 xl:col-span-3';
}

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const minScore = parseNum(sp.minScore) ?? 70;
  const sources = parseSources(sp.sources);
  const regions = parseList(sp.regions);
  const maxBudget = parseNum(sp.maxBudget);

  const filtersValue: DealsFiltersValue = {
    minScore,
    sources,
    regions,
    maxBudget: maxBudget ?? null,
  };

  const deals = await getTopDealsV2({
    limit: 24,
    minScore,
    sources: sources.length > 0 ? sources : undefined,
    regions: regions.length > 0 ? regions : undefined,
    maxBudget,
  });

  const [hero, ...rest] = deals;
  const totalShown = rest.length;
  const topProfit = deals.reduce((m, d) => Math.max(m, d.estProfitEur ?? 0), 0);
  const avgScore =
    deals.length > 0 ? Math.round(deals.reduce((s, d) => s + d.dealScore, 0) / deals.length) : 0;

  return (
    <div className="relative">
      {/* Ambient backdrop — subtle radial wash, dark mode only */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(16,185,129,0.08),transparent_70%)] dark:bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(16,185,129,0.12),transparent_70%)]"
      />

      <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* EDITORIAL MASTHEAD */}
        <header className="mb-8 grid gap-6 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <div className="inline-flex items-baseline gap-3 mb-2">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              <span className="font-mono text-[10px] font-medium uppercase tracking-[0.28em] text-muted-foreground">
                Deals · v2 · vážené DealScore
              </span>
            </div>
            <h1 className="font-heading text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
              Auta <span className="italic text-muted-foreground">pod cenou</span> trhu.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Algoritmus kombinuje zľavu, veľkosť kohortu, typ predajcu, kvalitu fotiek a
              čerstvosť inzerátu do jedného skóre 0–100.
            </p>
          </div>

          {/* Inline KPI ticker */}
          {deals.length > 0 ? (
            <div className="flex items-stretch divide-x divide-foreground/10 rounded-xl border border-foreground/10 bg-card/40 backdrop-blur-sm">
              <div className="px-4 py-3">
                <div className="font-mono text-[9px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Nájdené
                </div>
                <div className="mt-0.5 font-mono text-xl font-semibold tabular-nums">
                  {deals.length}
                </div>
              </div>
              <div className="px-4 py-3">
                <div className="font-mono text-[9px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Ø skóre
                </div>
                <div className="mt-0.5 font-mono text-xl font-semibold tabular-nums">
                  {avgScore}
                </div>
              </div>
              <div className="px-4 py-3">
                <div className="font-mono text-[9px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Top profit
                </div>
                <div className="mt-0.5 font-mono text-xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {Math.round(topProfit).toLocaleString('sk-SK')} €
                </div>
              </div>
            </div>
          ) : null}
        </header>

        <DealsFilters initial={filtersValue} />

        {deals.length === 0 ? (
          <div className="relative overflow-hidden rounded-3xl border border-dashed border-foreground/15 bg-card/30 p-12 text-center backdrop-blur-sm sm:p-20">
            {/* Decorative grid pattern */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.05] [background-image:linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] [background-size:32px_32px]"
            />
            <div className="relative mx-auto max-w-md">
              <div className="mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full border border-foreground/10 bg-background/60 text-muted-foreground">
                <Search className="size-6" />
              </div>
              <div className="font-mono text-[10px] font-medium uppercase tracking-[0.28em] text-muted-foreground">
                Žiadny match
              </div>
              <h2 className="font-heading mt-2 text-2xl font-semibold leading-tight">
                Trh je dnes vyrovnaný.
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Nič výrazne pod cenou neprešlo cez tvoje filtre. Skús znížiť min. DealScore
                alebo skontroluj zajtra — nové inzeráty pribúdajú každú hodinu.
              </p>
            </div>
          </div>
        ) : (
          <>
            {hero ? <HeroDeal deal={hero} /> : null}

            {totalShown > 0 ? (
              <>
                <div className="mb-4 flex items-baseline justify-between gap-4">
                  <div className="inline-flex items-baseline gap-3">
                    <span className="size-1.5 rounded-full bg-foreground/40" />
                    <span className="font-mono text-[10px] font-medium uppercase tracking-[0.28em] text-muted-foreground">
                      Ďalšie príležitosti · {totalShown}
                    </span>
                  </div>
                  <span className="hidden h-px flex-1 bg-foreground/10 sm:block" />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
                  {rest.map((d, i) => {
                    const size = sizeForIndex(i, totalShown, d.dealScore);
                    return (
                      <div key={d.listingId.toString()} className={spanForSize(size)}>
                        <DealCard deal={d} size={size} />
                      </div>
                    );
                  })}
                </div>
              </>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
