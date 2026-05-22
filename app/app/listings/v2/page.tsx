import { BrandChips } from '@/components/app/listings/v2/brand-chips';
import { FilterBar } from '@/components/app/listings/v2/filter-bar';
import { ListingCard } from '@/components/app/listings/v2/listing-card';
import {
  getListings,
  getListingsStats,
  getTopMakes,
  type ListingFilters,
  type ListingsSort,
} from '@/lib/db/queries/listings';
import type { RawFuel, Source } from '@/lib/scraping/types';
import { Search } from 'lucide-react';
import Link from 'next/link';

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

export const dynamic = 'force-dynamic';

const PER_PAGE = 24;
const VALID_SORTS: ListingsSort[] = ['newest', 'oldest', 'price-asc', 'price-desc'];

function formatNumber(n: number): string {
  return n.toLocaleString('sk-SK').replace(/,/g, ' ');
}

function parseSort(v: string | undefined): ListingsSort {
  if (v && (VALID_SORTS as string[]).includes(v)) return v as ListingsSort;
  return 'newest';
}

function pickStr(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function parseCsv<T extends string>(raw: string | undefined, allowed: readonly T[]): T[] {
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

export default async function ListingsV2Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const [stats, topMakes] = await Promise.all([getListingsStats(), getTopMakes(10)]);

  const pageRaw = typeof sp.page === 'string' ? Number(sp.page) : 1;
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;

  const q = pickStr(sp.q);
  const sourceRaw = pickStr(sp.source);
  const sources = sourceRaw ? parseCsv(sourceRaw, KNOWN_SOURCES) : [];
  const fuel = parseCsv(pickStr(sp.fuel), KNOWN_FUELS);
  const minPrice = parseInt0(pickStr(sp.minPrice), 0, 10_000_000);
  const maxPrice = parseInt0(pickStr(sp.maxPrice), 0, 10_000_000);
  const minYear = parseInt0(pickStr(sp.minYear), 1900, 2100);
  const maxYear = parseInt0(pickStr(sp.maxYear), 1900, 2100);
  const minKm = parseInt0(pickStr(sp.minKm), 0, 10_000_000);
  const maxKm = parseInt0(pickStr(sp.maxKm), 0, 10_000_000);
  const featuredOnly = pickStr(sp.featuredOnly) === '1';
  const sort = parseSort(pickStr(sp.sort));

  const filters: ListingFilters = {
    q,
    source: sources.length > 0 ? sources : undefined,
    fuel: fuel.length > 0 ? fuel : undefined,
    minPrice,
    maxPrice,
    minYear,
    maxYear,
    minKm,
    maxKm,
    featuredOnly: featuredOnly ? true : undefined,
  };

  const perPage = page * PER_PAGE;
  const { rows, total } = await getListings({
    page: 1,
    perPage,
    filters,
    sort,
  });

  const hasMore = rows.length < total;
  const nextParams = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (v == null) continue;
    if (Array.isArray(v)) {
      if (v[0]) nextParams.set(k, v[0]);
    } else {
      nextParams.set(k, v);
    }
  }
  nextParams.set('page', String(page + 1));

  return (
    <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
      {/* Hero header */}
      <div className="mx-auto mb-8 flex max-w-3xl flex-col items-center gap-4 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Nájdi auto, ktoré sa ti páči
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          {formatNumber(stats.totalListings)} áut zo {stats.bySource.length} bazárov, denne
          aktualizované
        </p>
        <form action="/app/listings/v2" method="get" className="relative w-full">
          <Search className="text-muted-foreground pointer-events-none absolute left-5 top-1/2 size-5 -translate-y-1/2" />
          <input
            type="search"
            name="q"
            defaultValue={q ?? ''}
            placeholder="Hľadaj auto..."
            className="border-border/60 bg-card focus-visible:ring-primary/30 h-14 w-full rounded-full border pl-14 pr-32 text-base shadow-sm transition outline-none focus-visible:border-primary focus-visible:ring-4"
          />
          <button
            type="submit"
            className="bg-primary text-primary-foreground hover:bg-primary/90 absolute right-2 top-1/2 h-10 -translate-y-1/2 rounded-full px-5 text-sm font-medium transition"
          >
            Hľadať
          </button>
        </form>
      </div>

      {/* Brand chips */}
      <div className="mb-5">
        <BrandChips makes={topMakes} activeQuery={q ?? ''} />
      </div>

      {/* Filters */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <FilterBar
          initialSources={sources}
          initialFuel={fuel}
          initialMinPrice={minPrice}
          initialMaxPrice={maxPrice}
          initialMinYear={minYear}
          initialMaxYear={maxYear}
          initialMinKm={minKm}
          initialMaxKm={maxKm}
          initialFeaturedOnly={featuredOnly}
          initialSort={sort}
        />
        <span className="text-muted-foreground hidden whitespace-nowrap text-sm tabular-nums sm:inline">
          {formatNumber(total)} áut
        </span>
      </div>

      {/* Grid */}
      {rows.length === 0 ? (
        <div className="border-border/60 text-muted-foreground rounded-2xl border p-16 text-center text-sm">
          Žiadne inzeráty pre tento filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.map((row) => (
            <ListingCard key={row.id.toString()} row={row} />
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <div className="mt-10 flex justify-center">
          <Link
            href={`/app/listings/v2?${nextParams.toString()}`}
            scroll={false}
            className="border-border bg-card hover:bg-muted inline-flex h-11 items-center rounded-full border px-8 text-sm font-medium transition"
          >
            Načítať ďalšie ({formatNumber(total - rows.length)} zostáva)
          </Link>
        </div>
      )}
    </div>
  );
}
