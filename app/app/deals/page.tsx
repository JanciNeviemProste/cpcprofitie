import { DealsTable } from '@/components/app/deals/deals-table';
import { getTopDeals, type DealsSort } from '@/lib/db/queries/trends';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Deals — podhodnotené inzeráty · CPCProfit' };

const VALID_SORTS: DealsSort[] = ['discount', 'gain'];

function parseSort(v: string | undefined): DealsSort {
  if (v && (VALID_SORTS as string[]).includes(v)) return v as DealsSort;
  return 'discount';
}

function parseInt(v: string | undefined): number | undefined {
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
}

function parseConf(
  v: string | undefined,
): 'low' | 'medium' | 'high' | undefined {
  if (v === 'low' || v === 'medium' || v === 'high') return v;
  return undefined;
}

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const sort = parseSort(typeof sp.sort === 'string' ? sp.sort : undefined);
  // Default to medium+ — low-confidence deals are noisy.
  const minConfidence =
    parseConf(typeof sp.confidence === 'string' ? sp.confidence : undefined) ?? 'medium';
  const minGainEur = parseInt(typeof sp.minGain === 'string' ? sp.minGain : undefined);
  const maxPriceEur = parseInt(typeof sp.maxPrice === 'string' ? sp.maxPrice : undefined);

  const rows = await getTopDeals({
    limit: 50,
    sort,
    filters: { minConfidence, minGainEur, maxPriceEur },
  });

  return (
    <div className="container mx-auto px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Deals</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Inzeráty pod trhovým mediánom. Cena pod P25 svojho kohortu (model + región +
          rok ±2 + km bucket) — potenciálne flip príležitosti.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {VALID_SORTS.map((s) => (
            <a
              key={s}
              href={`/app/deals?sort=${s}&confidence=${minConfidence}`}
              className={
                s === sort
                  ? 'bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-medium'
                  : 'border-border/60 hover:bg-muted rounded-md border px-3 py-1.5 text-xs font-medium'
              }
            >
              {s === 'discount' ? 'Najväčšia zľava' : 'Najväčší zisk'}
            </a>
          ))}
        </div>
        <div className="bg-border/40 mx-1 h-5 w-px" />
        <div className="flex gap-1">
          {(['low', 'medium', 'high'] as const).map((c) => (
            <a
              key={c}
              href={`/app/deals?sort=${sort}&confidence=${c}`}
              className={
                c === minConfidence
                  ? 'bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-medium'
                  : 'border-border/60 hover:bg-muted rounded-md border px-3 py-1.5 text-xs font-medium'
              }
            >
              {c === 'high' ? 'Min. vysoká' : c === 'medium' ? 'Min. stredná' : 'Všetky'}
            </a>
          ))}
        </div>
      </div>

      <DealsTable rows={rows} />
    </div>
  );
}
