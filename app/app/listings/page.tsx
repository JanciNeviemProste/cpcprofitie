import { ListingsFilterBar, type InitialFilters } from '@/components/app/listings/filter-bar';
import { ListingsTable } from '@/components/app/listings/listings-table';
import { Pagination } from '@/components/app/listings/pagination';
import {
  getDistinctRegions,
  getListings,
  getListingsStats,
  type ListingFilters,
  type ListingsSort,
} from '@/lib/db/queries/listings';
import type { RawFuel, Source } from '@/lib/scraping/types';

const SOURCE_COLORS: Record<string, string> = {
  'autobazar.eu': 'bg-blue-500',
  'bazos.sk': 'bg-emerald-500',
  'autobazar.sk': 'bg-amber-500',
};

const KNOWN_SOURCES: Source[] = ['autobazar.sk', 'autobazar.eu', 'bazos.sk'];
const KNOWN_FUELS: RawFuel[] = [
  'gasoline',
  'diesel',
  'hybrid',
  'phev',
  'electric',
  'lpg',
  'cng',
  'other',
];

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

function pickStr(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function parseCsv<T extends string>(
  raw: string | undefined,
  allowed: readonly T[],
): T[] {
  if (!raw) return [];
  const set = new Set<string>(allowed);
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && set.has(s)) as T[];
}

function parseInt0(raw: string | undefined, lo: number, hi: number): number | undefined {
  if (raw == null || raw === '') return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n)) return undefined;
  const r = Math.floor(n);
  if (r < lo || r > hi) return undefined;
  return r;
}

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const [stats, regions] = await Promise.all([getListingsStats(), getDistinctRegions()]);

  const pageRaw = typeof sp.page === 'string' ? Number(sp.page) : 1;
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;

  const q = pickStr(sp.q);
  const sourceRaw = pickStr(sp.source);
  // Back-compat: ?source=autobazar.sk (single value) still works; CSV is new.
  const sources = sourceRaw ? parseCsv(sourceRaw, KNOWN_SOURCES) : [];
  const fuel = parseCsv(pickStr(sp.fuel), KNOWN_FUELS);
  const regionsCsv = pickStr(sp.regions);
  const selectedRegions = regionsCsv
    ? regionsCsv
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && regions.includes(s))
    : [];

  const minPrice = parseInt0(pickStr(sp.minPrice), 0, 10_000_000);
  const maxPrice = parseInt0(pickStr(sp.maxPrice), 0, 10_000_000);
  const minYear = parseInt0(pickStr(sp.minYear), 1900, 2100);
  const maxYear = parseInt0(pickStr(sp.maxYear), 1900, 2100);
  const minKm = parseInt0(pickStr(sp.minKm), 0, 10_000_000);
  const maxKm = parseInt0(pickStr(sp.maxKm), 0, 10_000_000);
  const hasPhoto = pickStr(sp.hasPhoto) === '1';
  const featuredOnly = pickStr(sp.featuredOnly) === '1';
  const sort = parseSort(pickStr(sp.sort));

  const filters: ListingFilters = {
    q,
    source: sources.length > 0 ? sources : undefined,
    fuel: fuel.length > 0 ? fuel : undefined,
    regions: selectedRegions.length > 0 ? selectedRegions : undefined,
    minPrice,
    maxPrice,
    minYear,
    maxYear,
    minKm,
    maxKm,
    hasPhoto: hasPhoto ? true : undefined,
    featuredOnly: featuredOnly ? true : undefined,
  };

  const { rows, total } = await getListings({
    page,
    perPage: PER_PAGE,
    filters,
    sort,
  });

  const initialFilters: InitialFilters = {
    q,
    sources,
    fuel,
    regions: selectedRegions,
    minPrice,
    maxPrice,
    minYear,
    maxYear,
    minKm,
    maxKm,
    hasPhoto,
    featuredOnly,
    sort,
  };

  const photosPerListing =
    stats.totalListings > 0 ? Math.round(stats.totalPhotos / stats.totalListings) : 0;

  return (
    <div className="container mx-auto px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inzeráty</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Naživo zhromaždené dáta zo slovenských autobazárov.
          </p>
        </div>
        <span className="border-border/60 bg-card/40 text-muted-foreground rounded-full border px-3 py-1 text-xs">
          Nájdených{' '}
          <span className="text-foreground font-semibold tabular-nums">{formatNumber(total)}</span>{' '}
          áut
        </span>
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
        <ListingsFilterBar
          sources={stats.bySource}
          regions={regions}
          initialFilters={initialFilters}
        />
      </div>
      <div className="space-y-4">
        <ListingsTable rows={rows} />
        <Pagination page={page} perPage={PER_PAGE} total={total} searchParams={sp} />
      </div>
    </div>
  );
}
