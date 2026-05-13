import { ListingsFilterBar } from '@/components/app/listings/filter-bar';
import { ListingsTable } from '@/components/app/listings/listings-table';
import { Pagination } from '@/components/app/listings/pagination';
import { getListings, getSourceCounts, type ListingsSort } from '@/lib/db/queries/listings';
import type { Source } from '@/lib/scraping/types';

// Avoid PPR caching — listings table needs fresh DB reads.
export const dynamic = 'force-dynamic';

const PER_PAGE = 50;
const VALID_SORTS: ListingsSort[] = ['newest', 'oldest', 'price-asc', 'price-desc'];

function parseSort(v: string | undefined): ListingsSort {
  if (v && (VALID_SORTS as string[]).includes(v)) return v as ListingsSort;
  return 'newest';
}

function parseSource(v: string | undefined, known: Set<string>): Source | undefined {
  if (v && known.has(v)) return v as Source;
  return undefined;
}

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const sources = await getSourceCounts();
  const knownSources = new Set(sources.map((s) => s.source));

  const pageRaw = typeof sp.page === 'string' ? Number(sp.page) : 1;
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const q = typeof sp.q === 'string' ? sp.q : undefined;
  const source = parseSource(typeof sp.source === 'string' ? sp.source : undefined, knownSources);
  const sort = parseSort(typeof sp.sort === 'string' ? sp.sort : undefined);

  const { rows, total } = await getListings({
    page,
    perPage: PER_PAGE,
    filters: { q, source },
    sort,
  });

  return (
    <div className="container mx-auto px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Inzeráty</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {total.toLocaleString('sk-SK')} aktívnych inzerátov zo všetkých zdrojov.
        </p>
      </div>
      <div className="mb-4">
        <ListingsFilterBar sources={sources} />
      </div>
      <div className="space-y-4">
        <ListingsTable rows={rows} />
        <Pagination page={page} perPage={PER_PAGE} total={total} searchParams={sp} />
      </div>
    </div>
  );
}
