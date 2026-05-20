import { ListingsFilterBar } from '@/components/app/listings/filter-bar';
import { ListingsTable } from '@/components/app/listings/listings-table';
import { Pagination } from '@/components/app/listings/pagination';
import {
  getListings,
  getListingsStats,
  getSourceCounts,
  type ListingsSort,
} from '@/lib/db/queries/listings';
import type { Source } from '@/lib/scraping/types';

const SOURCE_COLORS: Record<string, string> = {
  'autobazar.eu': 'bg-blue-500',
  'bazos.sk': 'bg-emerald-500',
  'autobazar.sk': 'bg-amber-500',
};

function formatNumber(n: number): string {
  return n.toLocaleString('sk-SK').replace(/,/g, ' ');
}

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
  const stats = await getListingsStats();
  const sources = stats.bySource;
  const knownSources = new Set(sources.map((s) => s.source));
  const photosPerListing =
    stats.totalListings > 0 ? Math.round(stats.totalPhotos / stats.totalListings) : 0;

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
          Naživo zhromaždené dáta zo slovenských autobazárov.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="border-border/60 from-primary/5 relative overflow-hidden rounded-xl border bg-gradient-to-br to-transparent p-5">
          <div className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Inzerátov
          </div>
          <div className="mt-2 text-4xl font-bold tabular-nums tracking-tight">
            {formatNumber(stats.totalListings)}
          </div>
          <div className="text-muted-foreground mt-1 text-xs">aktívne na trhu</div>
        </div>

        <div className="border-border/60 relative overflow-hidden rounded-xl border bg-gradient-to-br from-blue-500/5 to-transparent p-5">
          <div className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Fotografií
          </div>
          <div className="mt-2 text-4xl font-bold tabular-nums tracking-tight">
            {formatNumber(stats.totalPhotos)}
          </div>
          <div className="text-muted-foreground mt-1 text-xs">
            ~{photosPerListing} na inzerát
          </div>
        </div>

        <div className="border-border/60 relative overflow-hidden rounded-xl border bg-gradient-to-br from-emerald-500/5 to-transparent p-5">
          <div className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Enriched
          </div>
          <div className="mt-2 text-4xl font-bold tabular-nums tracking-tight">
            {formatNumber(stats.totalEnriched)}
          </div>
          <div className="text-muted-foreground mt-1 text-xs">s VIN + výbavou</div>
        </div>

        <div className="border-border/60 relative overflow-hidden rounded-xl border bg-gradient-to-br from-amber-500/5 to-transparent p-5">
          <div className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Zdroje
          </div>
          <div className="mt-2 text-4xl font-bold tabular-nums tracking-tight">
            {stats.bySource.length}
          </div>
          <div className="text-muted-foreground mt-1 text-xs">SK autobazáre</div>
        </div>
      </div>

      <div className="border-border/60 mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border px-4 py-3 text-sm">
        <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          Rozloženie
        </span>
        {stats.bySource.map((s) => (
          <span key={s.source} className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${SOURCE_COLORS[s.source] ?? 'bg-muted-foreground'}`}
            />
            <span className="text-muted-foreground">{s.source}</span>
            <span className="font-semibold tabular-nums">{formatNumber(s.count)}</span>
          </span>
        ))}
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
