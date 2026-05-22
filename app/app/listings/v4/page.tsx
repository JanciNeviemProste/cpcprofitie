import Link from 'next/link';
import { V4DenseTable } from '@/components/app/listings/v4/dense-table';
import { V4FilterRow, type V4FilterState } from '@/components/app/listings/v4/filter-popovers';
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

const PER_PAGE = 50;
const VALID_SORTS: ListingsSort[] = ['newest', 'oldest', 'price-asc', 'price-desc'];

export const dynamic = 'force-dynamic';

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

function buildPageHref(
  page: number,
  sp: Record<string, string | string[] | undefined>,
): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (k === 'page') continue;
    if (typeof v === 'string' && v !== '') p.set(k, v);
  }
  if (page > 1) p.set('page', String(page));
  const qs = p.toString();
  return `/app/listings/v4${qs ? `?${qs}` : ''}`;
}

export default async function ListingsV4Page({
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

  const initialFilters: V4FilterState = {
    q,
    sources,
    fuel,
    regions: selectedRegions,
    minPrice,
    maxPrice,
    hasPhoto,
    featuredOnly,
    sort,
  };

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const prevHref = safePage > 1 ? buildPageHref(safePage - 1, sp) : null;
  const nextHref = safePage < totalPages ? buildPageHref(safePage + 1, sp) : null;

  return (
    <div className="mx-auto max-w-[1600px] px-3 py-3 sm:px-4">
      {/* Single-line header */}
      <header className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <h1 className="text-base font-bold tracking-tight">Inzeráty</h1>
        <span className="text-muted-foreground tabular-nums font-mono text-[11px]">
          {formatNumber(stats.totalListings)} celkom · {formatNumber(total)} nájdených ·{' '}
          {stats.bySource.map((s, i, arr) => (
            <span key={s.source}>
              <span className="text-foreground">{s.source.replace('.sk', '').replace('.eu', '')}</span>
              <span className="text-muted-foreground/70"> {formatNumber(s.count)}</span>
              {i < arr.length - 1 ? <span className="text-muted-foreground/40"> · </span> : null}
            </span>
          ))}
        </span>
        <Link
          href="/app/listings"
          className="text-muted-foreground hover:text-foreground ml-auto text-[11px] underline-offset-2 hover:underline"
        >
          ← classic view
        </Link>
      </header>

      {/* Compact filter row */}
      <div className="mb-2">
        <V4FilterRow
          sources={stats.bySource}
          regions={regionNames}
          initialFilters={initialFilters}
        />
      </div>

      {/* Dense table */}
      <V4DenseTable rows={rows} sort={sort} searchParams={sp} />

      {/* Single-line footer */}
      <footer className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="text-muted-foreground tabular-nums font-mono">
          {total > 0
            ? `${formatNumber((safePage - 1) * PER_PAGE + 1)}–${formatNumber(Math.min(safePage * PER_PAGE, total))} / ${formatNumber(total)}`
            : '0 inzerátov'}
        </div>
        <div className="flex items-center gap-1 font-mono tabular-nums">
          {prevHref ? (
            <Link
              href={prevHref}
              className="border-border/60 hover:bg-muted/60 hover:border-primary/40 rounded border px-2 py-0.5"
            >
              «
            </Link>
          ) : (
            <span className="border-border/30 text-muted-foreground/40 rounded border px-2 py-0.5">
              «
            </span>
          )}
          <span className="text-muted-foreground px-1">
            {formatNumber(safePage)}/{formatNumber(totalPages)}
          </span>
          {nextHref ? (
            <Link
              href={nextHref}
              className="border-border/60 hover:bg-muted/60 hover:border-primary/40 rounded border px-2 py-0.5"
            >
              »
            </Link>
          ) : (
            <span className="border-border/30 text-muted-foreground/40 rounded border px-2 py-0.5">
              »
            </span>
          )}
        </div>
        <div className="text-muted-foreground/60 hidden gap-2 font-mono text-[10px] sm:flex">
          <kbd className="border-border/40 rounded border px-1">?</kbd>
          <span>help</span>
          <kbd className="border-border/40 rounded border px-1">j/k</kbd>
          <span>rows</span>
          <kbd className="border-border/40 rounded border px-1">/</kbd>
          <span>search</span>
        </div>
      </footer>
    </div>
  );
}
