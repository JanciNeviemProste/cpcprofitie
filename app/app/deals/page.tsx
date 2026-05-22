import { DealsFilters, type DealsFiltersValue } from '@/components/app/deals/filters';
import { DealCard } from '@/components/app/deals/deal-card';
import { HeroDeal } from '@/components/app/deals/hero-deal';
import { getTopDealsV2 } from '@/lib/db/queries/deals';
import type { Source } from '@/lib/scraping/types';

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

  return (
    <div className="container mx-auto px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-bold tracking-tight">Deals</h1>
        <p className="text-muted-foreground mt-1.5 max-w-2xl text-sm">
          Auta pod cenou trhu — DealScore vážený algoritmus kombinuje zľavu, veľkosť
          kohortu, typ predajcu, kvalitu fotiek a čerstvosť inzerátu.
        </p>
      </header>

      <DealsFilters initial={filtersValue} />

      {deals.length === 0 ? (
        <div className="border-border/40 bg-card/40 rounded-2xl border p-12 text-center backdrop-blur-sm">
          <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted text-2xl">
            🚗
          </div>
          <h2 className="font-heading text-lg font-semibold">Žiadne deals momentálne</h2>
          <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
            Trh je vyrovnaný — žiadne auto neprešlo cez tvoje filtre. Skús znížiť min.
            DealScore alebo skontroluj zajtra.
          </p>
        </div>
      ) : (
        <>
          {hero ? <HeroDeal deal={hero} /> : null}
          {rest.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {rest.map((d) => (
                <DealCard key={d.listingId.toString()} deal={d} />
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
