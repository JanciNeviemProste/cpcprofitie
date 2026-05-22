import Link from 'next/link';
import { FilterSheet, type InitialFilters } from '@/components/app/listings/v1/filter-sheet';
import { HeroStats } from '@/components/app/listings/v1/hero-stats';
import { ListingCard } from '@/components/app/listings/v1/listing-card';
import {
  getListings,
  getListingsStats,
  getRegionGroups,
  type ListingFilters,
  type ListingsSort,
} from '@/lib/db/queries/listings';
import type { RawFuel, Source } from '@/lib/scraping/types';

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

function buildPageHref(
  page: number,
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (k === 'page') continue;
    if (typeof v === 'string' && v !== '') sp.set(k, v);
  }
  if (page > 1) sp.set('page', String(page));
  const qs = sp.toString();
  return `/app/listings/v1${qs ? `?${qs}` : ''}`;
}

export default async function ListingsV1Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const [stats, regionGroups] = await Promise.all([getListingsStats(), getRegionGroups()]);
  const regionNames = regionGroups.map((g) => g.name);

  const pageRaw = typeof sp.page === 'string' ? Number(sp.page) : 1;
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;

  const q = pickStr(sp.q);
  const sourceRaw = pickStr(sp.source);
  const sources = sourceRaw ? parseCsv(sourceRaw, KNOWN_SOURCES) : [];
  const fuel = parseCsv(pickStr(sp.fuel), KNOWN_FUELS);
  const regionsCsv = pickStr(sp.regions);
  const selectedRegions = regionsCsv
    ? regionsCsv
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && regionNames.includes(s))
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

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const prevHref = safePage > 1 ? buildPageHref(safePage - 1, sp) : null;
  const nextHref = safePage < totalPages ? buildPageHref(safePage + 1, sp) : null;

  return (
    <div className="container mx-auto space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <HeroStats
        totalListings={stats.totalListings}
        totalPhotos={stats.totalPhotos}
        totalEnriched={stats.totalEnriched}
        bySource={stats.bySource}
        resultCount={total}
      />

      <FilterSheet
        sources={stats.bySource}
        regions={regionNames}
        initialFilters={initialFilters}
      />

      {rows.length === 0 ? (
        <div className="border-border/40 bg-card/30 rounded-2xl border p-12 text-center backdrop-blur-sm">
          <div className="text-foreground text-base font-medium">Žiadne inzeráty</div>
          <div className="text-muted-foreground mt-1 text-sm">
            Skús zmäkčiť filtre alebo zmazať vyhľadávanie.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {rows.map((r) => (
            <ListingCard key={r.id.toString()} row={r} />
          ))}
        </div>
      )}

      {/* Compact pagination */}
      <div className="border-border/40 bg-card/30 sticky bottom-3 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm backdrop-blur-md">
        <div className="text-muted-foreground text-xs tabular-nums sm:text-sm">
          {total > 0
            ? `${((safePage - 1) * PER_PAGE + 1).toLocaleString('sk-SK')}–${Math.min(safePage * PER_PAGE, total).toLocaleString('sk-SK')} z ${total.toLocaleString('sk-SK')}`
            : 'Žiadne inzeráty'}
        </div>
        <div className="flex items-center gap-1.5">
          {prevHref ? (
            <Link
              href={prevHref}
              className="border-border/40 bg-background/60 hover:border-primary/40 hover:text-foreground inline-flex h-8 items-center rounded-lg border px-3 text-xs font-medium transition-all"
              aria-label="Predošlá strana"
            >
              ◂
            </Link>
          ) : (
            <span className="border-border/30 text-muted-foreground/50 inline-flex h-8 items-center rounded-lg border px-3 text-xs">
              ◂
            </span>
          )}
          <span className="text-foreground inline-flex h-8 min-w-[88px] items-center justify-center rounded-lg px-3 text-xs font-semibold tabular-nums">
            {safePage.toLocaleString('sk-SK')}{' '}
            <span className="text-muted-foreground mx-1 font-normal">/</span>{' '}
            {totalPages.toLocaleString('sk-SK')}
          </span>
          {nextHref ? (
            <Link
              href={nextHref}
              className="border-border/40 bg-background/60 hover:border-primary/40 hover:text-foreground inline-flex h-8 items-center rounded-lg border px-3 text-xs font-medium transition-all"
              aria-label="Ďalšia strana"
            >
              ▸
            </Link>
          ) : (
            <span className="border-border/30 text-muted-foreground/50 inline-flex h-8 items-center rounded-lg border px-3 text-xs">
              ▸
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
