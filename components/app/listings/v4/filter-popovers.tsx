'use client';

import { Popover } from '@base-ui/react/popover';
import { Tooltip } from '@base-ui/react/tooltip';
import {
  Filter as FilterIcon,
  ArrowUpDown,
  MapPin,
  Fuel as FuelIcon,
  CircleDollarSign,
  X,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState, useTransition } from 'react';
import type { RawFuel, Source } from '@/lib/scraping/types';
import { cn } from '@/lib/utils';

type SourceCount = { source: Source; count: number };

const SOURCE_OPTIONS: { value: Source; label: string }[] = [
  { value: 'autobazar.sk', label: 'autobazar.sk' },
  { value: 'autobazar.eu', label: 'autobazar.eu' },
  { value: 'bazos.sk', label: 'bazos.sk' },
];

const FUEL_OPTIONS: { value: RawFuel; label: string }[] = [
  { value: 'gasoline', label: 'Benzín' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'phev', label: 'PHEV' },
  { value: 'electric', label: 'Elektro' },
  { value: 'lpg', label: 'LPG' },
  { value: 'cng', label: 'CNG' },
];

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'newest', label: 'Najnovšie' },
  { value: 'oldest', label: 'Najstaršie' },
  { value: 'price-asc', label: 'Cena ↑' },
  { value: 'price-desc', label: 'Cena ↓' },
];

export type V4FilterState = {
  q?: string;
  sources: Source[];
  fuel: RawFuel[];
  regions: string[];
  minPrice?: number;
  maxPrice?: number;
  hasPhoto: boolean;
  featuredOnly: boolean;
  sort: string;
};

type Props = {
  sources: SourceCount[];
  regions: string[];
  initialFilters: V4FilterState;
};

function buildHref(state: V4FilterState): string {
  const p = new URLSearchParams();
  if (state.q && state.q.trim()) p.set('q', state.q.trim());
  if (state.sources.length === 1) p.set('source', state.sources[0]);
  else if (state.sources.length > 1) p.set('source', state.sources.join(','));
  if (state.fuel.length > 0) p.set('fuel', state.fuel.join(','));
  if (state.regions.length > 0) p.set('regions', state.regions.join(','));
  if (state.minPrice != null) p.set('minPrice', String(state.minPrice));
  if (state.maxPrice != null) p.set('maxPrice', String(state.maxPrice));
  if (state.hasPhoto) p.set('hasPhoto', '1');
  if (state.featuredOnly) p.set('featuredOnly', '1');
  if (state.sort && state.sort !== 'newest') p.set('sort', state.sort);
  const qs = p.toString();
  return qs ? `/app/listings/v4?${qs}` : '/app/listings/v4';
}

function activeCount(state: V4FilterState): number {
  let n = 0;
  if (state.sources.length) n++;
  if (state.fuel.length) n++;
  if (state.regions.length) n++;
  if (state.minPrice != null || state.maxPrice != null) n++;
  if (state.hasPhoto) n++;
  if (state.featuredOnly) n++;
  return n;
}

function PillTooltip({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={<span className="inline-flex" />}>
        {children}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={6}>
          <Tooltip.Popup className="border-border/60 bg-popover text-popover-foreground z-50 rounded-md border px-2 py-1 text-xs shadow-md">
            {label}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function PillButton({
  active,
  badge,
  children,
  ...rest
}: {
  active?: boolean;
  badge?: number;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        'inline-flex h-7 items-center gap-1 rounded-full border px-2 text-xs font-medium transition-colors',
        active
          ? 'border-primary/60 bg-primary/10 text-foreground'
          : 'border-border/60 bg-card/40 text-muted-foreground hover:border-primary/40 hover:bg-muted/60 hover:text-foreground',
        rest.className,
      )}
    >
      {children}
      {badge != null && badge > 0 ? (
        <span className="bg-primary text-primary-foreground inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] tabular-nums">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function PopoverShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Popover.Portal>
      <Popover.Positioner sideOffset={6} align="start">
        <Popover.Popup className="border-border/60 bg-popover text-popover-foreground z-50 min-w-[220px] rounded-lg border p-3 shadow-lg outline-none">
          {children}
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  );
}

export function V4FilterRow({ sources, regions, initialFilters }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [, startTransition] = useTransition();
  const [state, setState] = useState<V4FilterState>(initialFilters);
  const [q, setQ] = useState(initialFilters.q ?? '');

  const sourceCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of sources) m[s.source] = s.count;
    return m;
  }, [sources]);

  const push = useCallback(
    (next: V4FilterState) => {
      startTransition(() => {
        router.push(buildHref(next), { scroll: false });
      });
    },
    [router],
  );

  function update(patch: Partial<V4FilterState>) {
    setState((prev) => {
      const next = { ...prev, ...patch };
      push(next);
      return next;
    });
  }

  function toggle<T extends string>(arr: T[], v: T): T[] {
    return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
  }

  function reset() {
    const cleared: V4FilterState = {
      q: '',
      sources: [],
      fuel: [],
      regions: [],
      hasPhoto: false,
      featuredOnly: false,
      sort: state.sort,
    };
    setQ('');
    setState(cleared);
    push(cleared);
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    update({ q });
  }

  const activeN = activeCount(state);
  void sp;

  return (
    <Tooltip.Provider delay={200}>
      <div className="border-border/40 bg-card/30 flex flex-wrap items-center gap-1.5 rounded-lg border px-2 py-1.5 backdrop-blur-sm">
        {/* Sort */}
        <Popover.Root>
          <PillTooltip label="Zoradiť">
            <Popover.Trigger
              render={
                <PillButton active={state.sort !== 'newest'}>
                  <ArrowUpDown className="size-3.5" />
                  <span className="hidden sm:inline">
                    {SORT_OPTIONS.find((o) => o.value === state.sort)?.label ??
                      'Zoradiť'}
                  </span>
                </PillButton>
              }
            />
          </PillTooltip>
          <PopoverShell>
            <div className="flex flex-col gap-1">
              {SORT_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => update({ sort: o.value })}
                  className={cn(
                    'rounded px-2 py-1.5 text-left text-xs transition-colors',
                    state.sort === o.value
                      ? 'bg-primary/15 text-foreground'
                      : 'hover:bg-muted/60 text-muted-foreground',
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </PopoverShell>
        </Popover.Root>

        {/* Source */}
        <Popover.Root>
          <PillTooltip label="Zdroj">
            <Popover.Trigger
              render={
                <PillButton
                  active={state.sources.length > 0}
                  badge={state.sources.length}
                >
                  <FilterIcon className="size-3.5" />
                  <span className="hidden sm:inline">Zdroj</span>
                </PillButton>
              }
            />
          </PillTooltip>
          <PopoverShell>
            <div className="flex flex-col gap-1">
              {SOURCE_OPTIONS.map((o) => {
                const active = state.sources.includes(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() =>
                      update({ sources: toggle(state.sources, o.value) })
                    }
                    className={cn(
                      'flex items-center justify-between gap-3 rounded px-2 py-1.5 text-left text-xs transition-colors',
                      active
                        ? 'bg-primary/15 text-foreground'
                        : 'hover:bg-muted/60 text-muted-foreground',
                    )}
                  >
                    <span>{o.label}</span>
                    <span className="tabular-nums text-[10px] opacity-70">
                      {(sourceCounts[o.value] ?? 0).toLocaleString('sk-SK')}
                    </span>
                  </button>
                );
              })}
            </div>
          </PopoverShell>
        </Popover.Root>

        {/* Fuel */}
        <Popover.Root>
          <PillTooltip label="Palivo">
            <Popover.Trigger
              render={
                <PillButton
                  active={state.fuel.length > 0}
                  badge={state.fuel.length}
                >
                  <FuelIcon className="size-3.5" />
                  <span className="hidden sm:inline">Palivo</span>
                </PillButton>
              }
            />
          </PillTooltip>
          <PopoverShell>
            <div className="grid grid-cols-2 gap-1">
              {FUEL_OPTIONS.map((o) => {
                const active = state.fuel.includes(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() =>
                      update({ fuel: toggle(state.fuel, o.value) })
                    }
                    className={cn(
                      'rounded px-2 py-1.5 text-left text-xs transition-colors',
                      active
                        ? 'bg-primary/15 text-foreground'
                        : 'hover:bg-muted/60 text-muted-foreground',
                    )}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </PopoverShell>
        </Popover.Root>

        {/* Region */}
        {regions.length > 0 && (
          <Popover.Root>
            <PillTooltip label="Región">
              <Popover.Trigger
                render={
                  <PillButton
                    active={state.regions.length > 0}
                    badge={state.regions.length}
                  >
                    <MapPin className="size-3.5" />
                    <span className="hidden sm:inline">Región</span>
                  </PillButton>
                }
              />
            </PillTooltip>
            <PopoverShell>
              <div className="flex flex-col gap-1 max-h-72 overflow-y-auto min-w-[180px]">
                {regions.map((r) => {
                  const active = state.regions.includes(r);
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() =>
                        update({ regions: toggle(state.regions, r) })
                      }
                      className={cn(
                        'rounded px-2 py-1.5 text-left text-xs transition-colors',
                        active
                          ? 'bg-primary/15 text-foreground'
                          : 'hover:bg-muted/60 text-muted-foreground',
                      )}
                    >
                      {r}
                    </button>
                  );
                })}
              </div>
            </PopoverShell>
          </Popover.Root>
        )}

        {/* Price */}
        <Popover.Root>
          <PillTooltip label="Cena">
            <Popover.Trigger
              render={
                <PillButton
                  active={state.minPrice != null || state.maxPrice != null}
                  badge={
                    state.minPrice != null || state.maxPrice != null ? 1 : 0
                  }
                >
                  <CircleDollarSign className="size-3.5" />
                  <span className="hidden sm:inline">Cena</span>
                </PillButton>
              }
            />
          </PillTooltip>
          <PopoverShell>
            <div className="flex flex-col gap-2 min-w-[200px]">
              <div className="text-muted-foreground text-[10px] uppercase tracking-wide">
                Cena (€)
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="Od"
                  defaultValue={state.minPrice ?? ''}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    update({ minPrice: v ? Number(v) : undefined });
                  }}
                  className="border-border/60 bg-background h-7 w-full rounded-md border px-2 text-xs tabular-nums"
                />
                <span className="text-muted-foreground text-xs">–</span>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="Do"
                  defaultValue={state.maxPrice ?? ''}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    update({ maxPrice: v ? Number(v) : undefined });
                  }}
                  className="border-border/60 bg-background h-7 w-full rounded-md border px-2 text-xs tabular-nums"
                />
              </div>
            </div>
          </PopoverShell>
        </Popover.Root>

        {/* Toggles */}
        <PillTooltip label="Len s fotkou">
          <PillButton
            active={state.hasPhoto}
            onClick={() => update({ hasPhoto: !state.hasPhoto })}
          >
            <span className="text-[10px] uppercase tracking-wide">Foto</span>
          </PillButton>
        </PillTooltip>
        <PillTooltip label="Len featured">
          <PillButton
            active={state.featuredOnly}
            onClick={() => update({ featuredOnly: !state.featuredOnly })}
          >
            <span className="text-[10px] uppercase tracking-wide">★</span>
          </PillButton>
        </PillTooltip>

        {activeN > 0 && (
          <PillTooltip label="Resetovať filtre">
            <PillButton onClick={reset}>
              <X className="size-3.5" />
            </PillButton>
          </PillTooltip>
        )}

        <div className="ml-auto">
          <form onSubmit={submitSearch}>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="/ Hľadať (Octavia, BMW…)"
              className="border-border/60 bg-background placeholder:text-muted-foreground/60 h-7 w-44 rounded-md border px-2 text-xs sm:w-56 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </form>
        </div>
      </div>
    </Tooltip.Provider>
  );
}
