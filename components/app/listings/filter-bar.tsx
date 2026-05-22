'use client';

import { Slider } from '@base-ui/react/slider';
import { ChevronDown } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import type { RawFuel, Source } from '@/lib/scraping/types';

type SourceCount = { source: Source; count: number };

export type InitialFilters = {
  q?: string;
  sources: Source[];
  fuel: RawFuel[];
  regions: string[];
  minPrice?: number;
  maxPrice?: number;
  minYear?: number;
  maxYear?: number;
  minKm?: number;
  maxKm?: number;
  hasPhoto: boolean;
  featuredOnly: boolean;
  sort?: string;
};

type Props = {
  sources: SourceCount[];
  /** Kraj names (from getRegionGroups). */
  regions: string[];
  initialFilters: InitialFilters;
};

const PRICE_MIN = 0;
const PRICE_MAX = 100_000;
const YEAR_MIN = 1990;
const YEAR_MAX = 2026;
const KM_MIN = 0;
const KM_MAX = 500_000;

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

const SORT_OPTIONS = [
  { value: 'newest', label: 'Najnovšie' },
  { value: 'oldest', label: 'Najstaršie' },
  { value: 'price-asc', label: 'Cena ↑' },
  { value: 'price-desc', label: 'Cena ↓' },
];

function fmt(n: number): string {
  return n.toLocaleString('sk-SK').replace(/,/g, ' ');
}

function buildParams(state: InitialFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (state.q && state.q.trim()) p.set('q', state.q.trim());
  if (state.sources.length === 1) p.set('source', state.sources[0]);
  else if (state.sources.length > 1) p.set('source', state.sources.join(','));
  if (state.fuel.length > 0) p.set('fuel', state.fuel.join(','));
  if (state.regions.length > 0) p.set('regions', state.regions.join(','));
  if (state.minPrice != null && state.minPrice !== PRICE_MIN)
    p.set('minPrice', String(state.minPrice));
  if (state.maxPrice != null && state.maxPrice !== PRICE_MAX)
    p.set('maxPrice', String(state.maxPrice));
  if (state.minYear != null && state.minYear !== YEAR_MIN)
    p.set('minYear', String(state.minYear));
  if (state.maxYear != null && state.maxYear !== YEAR_MAX)
    p.set('maxYear', String(state.maxYear));
  if (state.minKm != null && state.minKm !== KM_MIN) p.set('minKm', String(state.minKm));
  if (state.maxKm != null && state.maxKm !== KM_MAX) p.set('maxKm', String(state.maxKm));
  if (state.hasPhoto) p.set('hasPhoto', '1');
  if (state.featuredOnly) p.set('featuredOnly', '1');
  if (state.sort && state.sort !== 'newest') p.set('sort', state.sort);
  return p;
}

function RangeSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  formatValue,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: [number, number];
  onChange: (v: [number, number]) => void;
  formatValue: (n: number) => string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          {label}
        </label>
        <span className="text-foreground text-sm font-medium tabular-nums">
          {formatValue(value[0])} – {formatValue(value[1])}
        </span>
      </div>
      <Slider.Root
        min={min}
        max={max}
        step={step}
        value={value}
        onValueChange={(v) => {
          if (Array.isArray(v) && v.length === 2) {
            onChange([v[0] as number, v[1] as number]);
          }
        }}
      >
        <Slider.Control className="relative flex h-5 w-full touch-none items-center">
          <Slider.Track className="bg-muted relative h-1.5 w-full grow overflow-hidden rounded-full">
            <Slider.Indicator className="bg-primary absolute h-full" />
          </Slider.Track>
          <Slider.Thumb className="border-primary bg-background block h-4 w-4 rounded-full border-2 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40" />
          <Slider.Thumb className="border-primary bg-background block h-4 w-4 rounded-full border-2 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40" />
        </Slider.Control>
      </Slider.Root>
    </div>
  );
}

function ChipGroup<T extends string>({
  options,
  selected,
  onToggle,
  counts,
}: {
  options: { value: T; label: string }[];
  selected: T[];
  onToggle: (v: T) => void;
  counts?: Record<string, number>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = selected.includes(o.value);
        const count = counts?.[o.value];
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onToggle(o.value)}
            className={
              'inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs transition-colors ' +
              (active
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border/60 bg-background hover:border-primary/40 hover:bg-muted/50')
            }
          >
            <span>{o.label}</span>
            {count != null && (
              <span
                className={'tabular-nums ' + (active ? 'opacity-80' : 'text-muted-foreground')}
              >
                {count.toLocaleString('sk-SK')}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function ListingsFilterBar({ sources, regions, initialFilters }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [, startTransition] = useTransition();

  const [state, setState] = useState<InitialFilters>(initialFilters);
  const [expanded, setExpanded] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirst = useRef(true);

  const sourceCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of sources) map[s.source] = s.count;
    return map;
  }, [sources]);

  const push = useCallback(
    (next: InitialFilters) => {
      const params = buildParams(next);
      const qs = params.toString();
      startTransition(() => {
        router.push(qs ? `/app/listings?${qs}` : '/app/listings', { scroll: false });
      });
    },
    [router],
  );

  // Debounced URL sync on state changes (400ms)
  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => push(state), 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [state, push]);

  // Keep local state in sync with external URL changes (e.g. back/forward).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setState(initialFilters);
    isFirst.current = true;
  }, [sp.toString()]);

  function toggle<T extends string>(arr: T[], v: T): T[] {
    return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
  }

  function reset() {
    const cleared: InitialFilters = {
      q: '',
      sources: [],
      fuel: [],
      regions: [],
      hasPhoto: false,
      featuredOnly: false,
      sort: state.sort,
    };
    setState(cleared);
  }

  function applyNow() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    push(state);
  }

  return (
    <div className="border-border/40 bg-card/40 sticky top-16 z-20 rounded-2xl border p-5 shadow-sm backdrop-blur-sm">
      {/* Compact bar — always visible */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={state.q ?? ''}
          onChange={(e) => setState((s) => ({ ...s, q: e.target.value }))}
          placeholder="Hľadať (napr. Octavia)"
          className="border-border/60 bg-background h-9 min-w-[180px] flex-1 rounded-md border px-3 text-sm"
        />

        <select
          value={state.sort ?? 'newest'}
          onChange={(e) => setState((s) => ({ ...s, sort: e.target.value }))}
          className="border-border/60 bg-background h-9 rounded-md border px-2 text-sm"
          aria-label="Zoradiť"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setState((s) => ({ ...s, hasPhoto: !s.hasPhoto }))}
          className={
            'inline-flex h-9 items-center rounded-md border px-3 text-xs transition-colors ' +
            (state.hasPhoto
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border/60 bg-background hover:bg-muted/50')
          }
        >
          Len s fotkou
        </button>
        <button
          type="button"
          onClick={() => setState((s) => ({ ...s, featuredOnly: !s.featuredOnly }))}
          className={
            'inline-flex h-9 items-center rounded-md border px-3 text-xs transition-colors ' +
            (state.featuredOnly
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border/60 bg-background hover:bg-muted/50')
          }
        >
          Featured
        </button>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="border-border/60 hover:bg-muted/50 inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-medium"
        >
          Rozšírené filtre
          <ChevronDown
            className={'h-3.5 w-3.5 transition-transform ' + (expanded ? 'rotate-180' : '')}
          />
        </button>
      </div>

      {/* Expanded section */}
      {expanded && (
        <div className="border-border/40 mt-5 space-y-5 border-t pt-5">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <RangeSlider
              label="Cena (€)"
              min={PRICE_MIN}
              max={PRICE_MAX}
              step={500}
              value={[state.minPrice ?? PRICE_MIN, state.maxPrice ?? PRICE_MAX]}
              onChange={([a, b]) =>
                setState((s) => ({
                  ...s,
                  minPrice: a === PRICE_MIN ? undefined : a,
                  maxPrice: b === PRICE_MAX ? undefined : b,
                }))
              }
              formatValue={(n) => `${fmt(n)} €`}
            />
            <RangeSlider
              label="Rok výroby"
              min={YEAR_MIN}
              max={YEAR_MAX}
              step={1}
              value={[state.minYear ?? YEAR_MIN, state.maxYear ?? YEAR_MAX]}
              onChange={([a, b]) =>
                setState((s) => ({
                  ...s,
                  minYear: a === YEAR_MIN ? undefined : a,
                  maxYear: b === YEAR_MAX ? undefined : b,
                }))
              }
              formatValue={(n) => String(n)}
            />
            <RangeSlider
              label="Najazdené (km)"
              min={KM_MIN}
              max={KM_MAX}
              step={5000}
              value={[state.minKm ?? KM_MIN, state.maxKm ?? KM_MAX]}
              onChange={([a, b]) =>
                setState((s) => ({
                  ...s,
                  minKm: a === KM_MIN ? undefined : a,
                  maxKm: b === KM_MAX ? undefined : b,
                }))
              }
              formatValue={(n) => fmt(n)}
            />
          </div>

          {/* Source + Fuel — one line */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Zdroj
              </span>
              <ChipGroup
                options={SOURCE_OPTIONS}
                selected={state.sources}
                onToggle={(v) =>
                  setState((s) => ({ ...s, sources: toggle(s.sources, v) }))
                }
                counts={sourceCounts}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Palivo
              </span>
              <ChipGroup
                options={FUEL_OPTIONS}
                selected={state.fuel}
                onToggle={(v) => setState((s) => ({ ...s, fuel: toggle(s.fuel, v) }))}
              />
            </div>
          </div>

          {/* Region — 8 kraj chips */}
          {regions.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Región
              </span>
              <ChipGroup
                options={regions.map((r) => ({ value: r, label: r }))}
                selected={state.regions}
                onToggle={(v) =>
                  setState((s) => ({ ...s, regions: toggle(s.regions, v) }))
                }
              />
            </div>
          )}

          {/* Actions */}
          <div className="border-border/40 flex items-center gap-2 border-t pt-4">
            <button
              type="button"
              onClick={applyNow}
              className="bg-primary text-primary-foreground hover:bg-primary/90 h-9 rounded-md px-4 text-sm font-medium"
            >
              Použiť
            </button>
            <button
              type="button"
              onClick={reset}
              className="border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/50 h-9 rounded-md border px-3 text-sm"
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
