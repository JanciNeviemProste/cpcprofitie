import Link from 'next/link';
import { EditorialCard } from '@/components/app/listings/v3/editorial-card';
import { SidebarFilter, type V3Filters } from '@/components/app/listings/v3/sidebar-filter';
import { VariantSwitcher } from '@/components/app/listings/variant-switcher';
import { Separator } from '@/components/ui/separator';
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

function formatNumber(n: number): string {
  return n.toLocaleString('sk-SK').replace(/,/g, ' ');
}

// Avoid PPR caching — listings table needs fresh DB reads.
export const dynamic = 'force-dynamic';

const PER_PAGE = 24;
const VALID_SORTS: ListingsSort[] = ['newest', 'oldest', 'price-asc', 'price-desc'];

const SORT_LABELS: Record<ListingsSort, string> = {
  newest: 'Najnovšie',
  oldest: 'Najstaršie',
  'price-asc': 'Cena ↑',
  'price-desc': 'Cena ↓',
};

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

function buildHref(
  page: number,
  searchParams: Record<string, string | string[] | undefined>,
  overrides: Record<string, string | undefined> = {},
): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (k === 'page') continue;
    if (k in overrides) continue;
    if (typeof v === 'string' && v !== '') sp.set(k, v);
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v != null && v !== '') sp.set(k, v);
  }
  if (page > 1) sp.set('page', String(page));
  const qs = sp.toString();
  return `/app/listings/v3${qs ? `?${qs}` : ''}`;
}

export default async function ListingsV3Page({
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

  const initialFilters: V3Filters = {
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
  const prevHref = safePage > 1 ? buildHref(safePage - 1, sp) : null;
  const nextHref = safePage < totalPages ? buildHref(safePage + 1, sp) : null;

  const lastUpdated = new Date().toLocaleString('sk-SK', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="container mx-auto px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <VariantSwitcher active="v3" />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[280px_1fr]">
        <SidebarFilter
          sources={stats.bySource}
          regions={regionNames}
          initialFilters={initialFilters}
        />

        <main className="min-w-0">
          {/* Editorial header */}
          <header className="mb-10">
            <p className="text-muted-foreground mb-3 text-[10px] font-semibold uppercase tracking-[0.18em]">
              CPCProfit Trh · Vydanie {new Date().getFullYear()}
            </p>
            <h1 className="font-serif text-4xl leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Trh áut Slovensko
            </h1>
            <p className="text-muted-foreground mt-5 max-w-2xl font-serif text-lg italic leading-relaxed">
              Aktuálne sledujeme{' '}
              <span className="text-foreground not-italic font-medium tabular-nums">
                {formatNumber(stats.totalListings)}
              </span>{' '}
              inzerátov z troch najväčších slovenských autobazárov. Pre tento filter sme našli{' '}
              <span className="text-foreground not-italic font-medium tabular-nums">
                {formatNumber(total)}
              </span>{' '}
              vozidiel. Editoriálny prehľad ponuky, denne obnovovaný.
            </p>
            <Separator className="mt-6" />
            <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-[10px] font-medium uppercase tracking-[0.14em]">
              <span>Posledná aktualizácia: {lastUpdated}</span>
              <span aria-hidden>·</span>
              <span>{formatNumber(stats.totalPhotos)} fotiek</span>
              <span aria-hidden>·</span>
              <span>{stats.bySource.length} zdroje</span>
            </div>
          </header>

          {/* Sort row */}
          <div className="border-border/30 mb-8 flex flex-wrap items-center justify-between gap-3 border-b pb-3">
            <p className="text-muted-foreground text-xs">
              Zobrazené{' '}
              <span className="text-foreground font-mono tabular-nums">
                {((safePage - 1) * PER_PAGE + 1).toLocaleString('sk-SK')}–
                {Math.min(safePage * PER_PAGE, total).toLocaleString('sk-SK')}
              </span>{' '}
              z <span className="text-foreground font-mono tabular-nums">{formatNumber(total)}</span>
            </p>
            <div className="flex items-center gap-2">
              <label
                htmlFor="v3-sort"
                className="text-muted-foreground text-[10px] font-semibold uppercase tracking-[0.14em]"
              >
                Zoradiť
              </label>
              <SortDropdown current={sort} searchParams={sp} />
            </div>
          </div>

          {/* Feed */}
          {rows.length === 0 ? (
            <div className="border-border/40 rounded-lg border p-16 text-center">
              <p className="font-serif text-xl text-foreground">Žiadne inzeráty</p>
              <p className="text-muted-foreground mt-2 text-sm">
                Skúste uvoľniť filter alebo zrušiť všetky kritériá.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {rows.map((r) => (
                <EditorialCard key={r.id.toString()} row={r} />
              ))}
            </div>
          )}

          {/* Bottom nav */}
          <nav className="border-border/30 mt-12 flex items-center justify-between border-t pt-6">
            {prevHref ? (
              <Link
                href={prevHref}
                className="text-foreground hover:text-foreground/70 group inline-flex items-center gap-2 text-sm font-medium"
              >
                <span className="transition-transform group-hover:-translate-x-1">←</span>
                <span className="font-serif text-base italic">Predošlé</span>
              </Link>
            ) : (
              <span className="text-muted-foreground inline-flex items-center gap-2 text-sm font-medium opacity-40">
                <span>←</span>
                <span className="font-serif text-base italic">Predošlé</span>
              </span>
            )}
            <span className="text-muted-foreground font-mono text-xs tabular-nums">
              {safePage} / {totalPages}
            </span>
            {nextHref ? (
              <Link
                href={nextHref}
                className="text-foreground hover:text-foreground/70 group inline-flex items-center gap-2 text-sm font-medium"
              >
                <span className="font-serif text-base italic">Ďalšie</span>
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </Link>
            ) : (
              <span className="text-muted-foreground inline-flex items-center gap-2 text-sm font-medium opacity-40">
                <span className="font-serif text-base italic">Ďalšie</span>
                <span>→</span>
              </span>
            )}
          </nav>
        </main>
      </div>
    </div>
  );
}

function SortDropdown({
  current,
  searchParams,
}: {
  current: ListingsSort;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  // Server-rendered native <form> for sort change — no client island needed.
  // We render plain links so it stays SSR-compatible. Using <details> for tiny
  // dropdown without extra JS.
  return (
    <details className="group/sort relative">
      <summary className="border-border/60 bg-background hover:bg-muted/40 flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium [&::-webkit-details-marker]:hidden">
        {SORT_LABELS[current]}
        <span className="text-muted-foreground transition-transform group-open/sort:rotate-180">
          ▾
        </span>
      </summary>
      <div className="border-border/60 bg-background absolute right-0 z-10 mt-1.5 w-44 overflow-hidden rounded-md border shadow-lg">
        {VALID_SORTS.map((s) => {
          const href = buildHref(1, searchParams, {
            sort: s === 'newest' ? undefined : s,
          });
          const active = s === current;
          return (
            <Link
              key={s}
              href={href}
              className={
                'hover:bg-muted/60 block px-3 py-2 text-sm ' +
                (active ? 'text-foreground bg-muted/40 font-medium' : 'text-muted-foreground')
              }
            >
              {SORT_LABELS[s]}
            </Link>
          );
        })}
      </div>
    </details>
  );
}
