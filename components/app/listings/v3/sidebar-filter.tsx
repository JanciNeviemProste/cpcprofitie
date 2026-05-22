'use client';

import { Checkbox } from '@base-ui/react/checkbox';
import { Slider } from '@base-ui/react/slider';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { RawFuel, Source } from '@/lib/scraping/types';

type SourceCount = { source: Source; count: number };

export type V3Filters = {
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
  regions: string[];
  initialFilters: V3Filters;
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

function fmt(n: number): string {
  return n.toLocaleString('sk-SK').replace(/,/g, ' ');
}

function buildParams(state: V3Filters): URLSearchParams {
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

function CheckRow({
  id,
  label,
  count,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  count?: number;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="hover:bg-muted/40 flex cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1.5 text-sm"
    >
      <Checkbox.Root
        id={id}
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(Boolean(v))}
        className={cn(
          'border-border bg-background data-[checked]:bg-foreground data-[checked]:border-foreground flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors',
          'focus-visible:ring-ring/40 focus-visible:ring-2 focus-visible:outline-none',
        )}
      >
        <Checkbox.Indicator className="text-background data-[unchecked]:hidden">
          <svg
            viewBox="0 0 12 12"
            className="h-3 w-3"
            aria-hidden
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2.5 6.5L5 9L9.5 3.5" />
          </svg>
        </Checkbox.Indicator>
      </Checkbox.Root>
      <span className="flex-1 text-foreground">{label}</span>
      {count != null ? (
        <span className="text-muted-foreground font-mono text-[11px] tabular-nums">
          {count.toLocaleString('sk-SK')}
        </span>
      ) : null}
    </label>
  );
}

function RangeSection({
  label,
  min,
  max,
  step,
  value,
  onChange,
  unit,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: [number, number];
  onChange: (v: [number, number]) => void;
  unit?: string;
}) {
  const [lo, hi] = value;
  return (
    <div className="flex flex-col gap-3">
      <div className="text-muted-foreground text-[10px] font-semibold uppercase tracking-[0.12em]">
        {label}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          value={lo}
          min={min}
          max={hi}
          step={step}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onChange([Math.max(min, Math.min(n, hi)), hi]);
          }}
          className="border-border/60 bg-background focus:border-foreground/50 h-9 w-full rounded-md border px-2 font-mono text-sm tabular-nums outline-none"
        />
        <span className="text-muted-foreground text-xs">–</span>
        <input
          type="number"
          inputMode="numeric"
          value={hi}
          min={lo}
          max={max}
          step={step}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onChange([lo, Math.min(max, Math.max(n, lo))]);
          }}
          className="border-border/60 bg-background focus:border-foreground/50 h-9 w-full rounded-md border px-2 font-mono text-sm tabular-nums outline-none"
        />
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
          <Slider.Track className="bg-muted relative h-1 w-full grow overflow-hidden rounded-full">
            <Slider.Indicator className="bg-foreground absolute h-full" />
          </Slider.Track>
          <Slider.Thumb className="border-foreground bg-background focus-visible:ring-foreground/30 block h-3.5 w-3.5 rounded-full border-2 shadow-sm focus-visible:outline-none focus-visible:ring-2" />
          <Slider.Thumb className="border-foreground bg-background focus-visible:ring-foreground/30 block h-3.5 w-3.5 rounded-full border-2 shadow-sm focus-visible:outline-none focus-visible:ring-2" />
        </Slider.Control>
      </Slider.Root>
      <div className="text-muted-foreground -mt-1 flex justify-between font-mono text-[10px] tabular-nums">
        <span>
          {fmt(min)}
          {unit ? ` ${unit}` : ''}
        </span>
        <span>
          {fmt(max)}
          {unit ? ` ${unit}` : ''}
        </span>
      </div>
    </div>
  );
}

function FilterBody({
  state,
  setState,
  sourceCounts,
  regions,
}: {
  state: V3Filters;
  setState: React.Dispatch<React.SetStateAction<V3Filters>>;
  sourceCounts: Record<string, number>;
  regions: string[];
}) {
  function toggle<T extends string>(arr: T[], v: T): T[] {
    return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
  }
  return (
    <div className="space-y-7">
      <div>
        <input
          type="search"
          value={state.q ?? ''}
          onChange={(e) => setState((s) => ({ ...s, q: e.target.value }))}
          placeholder="Hľadať (napr. Octavia)"
          className="border-border/60 bg-background focus:border-foreground/50 h-10 w-full rounded-md border px-3 text-sm outline-none"
        />
      </div>

      <section>
        <h3 className="text-muted-foreground mb-2 text-[10px] font-semibold uppercase tracking-[0.12em]">
          Zdroj
        </h3>
        <div className="flex flex-col">
          {SOURCE_OPTIONS.map((o) => (
            <CheckRow
              key={o.value}
              id={`v3-src-${o.value}`}
              label={o.label}
              count={sourceCounts[o.value]}
              checked={state.sources.includes(o.value)}
              onCheckedChange={() =>
                setState((s) => ({ ...s, sources: toggle(s.sources, o.value) }))
              }
            />
          ))}
        </div>
      </section>

      <Separator />

      <section>
        <h3 className="text-muted-foreground mb-2 text-[10px] font-semibold uppercase tracking-[0.12em]">
          Palivo
        </h3>
        <div className="flex flex-col">
          {FUEL_OPTIONS.map((o) => (
            <CheckRow
              key={o.value}
              id={`v3-fuel-${o.value}`}
              label={o.label}
              checked={state.fuel.includes(o.value)}
              onCheckedChange={() => setState((s) => ({ ...s, fuel: toggle(s.fuel, o.value) }))}
            />
          ))}
        </div>
      </section>

      <Separator />

      {regions.length > 0 ? (
        <>
          <section>
            <h3 className="text-muted-foreground mb-2 text-[10px] font-semibold uppercase tracking-[0.12em]">
              Región
            </h3>
            <div className="flex flex-col">
              {regions.map((r) => (
                <CheckRow
                  key={r}
                  id={`v3-reg-${r}`}
                  label={r}
                  checked={state.regions.includes(r)}
                  onCheckedChange={() =>
                    setState((s) => ({ ...s, regions: toggle(s.regions, r) }))
                  }
                />
              ))}
            </div>
          </section>
          <Separator />
        </>
      ) : null}

      <RangeSection
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
        unit="€"
      />

      <RangeSection
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
      />

      <RangeSection
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
        unit="km"
      />

      <Separator />

      <div className="flex flex-col gap-1">
        <CheckRow
          id="v3-hasPhoto"
          label="Len s fotkou"
          checked={state.hasPhoto}
          onCheckedChange={(v) => setState((s) => ({ ...s, hasPhoto: v }))}
        />
        <CheckRow
          id="v3-featured"
          label="Featured"
          checked={state.featuredOnly}
          onCheckedChange={(v) => setState((s) => ({ ...s, featuredOnly: v }))}
        />
      </div>
    </div>
  );
}

export function SidebarFilter({ sources, regions, initialFilters }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [, startTransition] = useTransition();

  const [state, setState] = useState<V3Filters>(initialFilters);
  const lastPushedRef = useRef<string>('');

  const sourceCounts: Record<string, number> = {};
  for (const s of sources) sourceCounts[s.source] = s.count;

  const push = useCallback(
    (next: V3Filters) => {
      const params = buildParams(next);
      const qs = params.toString();
      lastPushedRef.current = qs;
      startTransition(() => {
        router.push(qs ? `/app/listings/v3?${qs}` : '/app/listings/v3', { scroll: false });
      });
    },
    [router],
  );

  // Keep state in sync if user navigates back/forward
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const current = sp.toString();
    if (current === lastPushedRef.current) return;
    setState(initialFilters);
  }, [sp.toString()]);

  function reset() {
    const cleared: V3Filters = {
      q: '',
      sources: [],
      fuel: [],
      regions: [],
      hasPhoto: false,
      featuredOnly: false,
      sort: state.sort,
    };
    setState(cleared);
    push(cleared);
  }

  function applyNow() {
    push(state);
  }

  return (
    <>
      {/* Mobile: collapsible accordion */}
      <div className="lg:hidden">
        <Accordion>
          <AccordionItem value="filters">
            <AccordionTrigger className="font-serif text-lg">Filtre</AccordionTrigger>
            <AccordionContent>
              <div className="pt-2 pb-4">
                <FilterBody
                  state={state}
                  setState={setState}
                  sourceCounts={sourceCounts}
                  regions={regions}
                />
                <div className="border-border/30 mt-6 flex items-center gap-3 border-t pt-4">
                  <Button onClick={applyNow} className="flex-1">
                    Použiť filter
                  </Button>
                  <button
                    type="button"
                    onClick={reset}
                    className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-4"
                  >
                    Zrušiť všetko
                  </button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {/* Desktop: sticky sidebar */}
      <aside className="sticky top-20 hidden max-h-[calc(100vh-6rem)] flex-col lg:flex">
        <div className="flex items-baseline justify-between pb-4">
          <h2 className="font-serif text-2xl text-foreground">Filtre</h2>
          <button
            type="button"
            onClick={reset}
            className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-4"
          >
            Zrušiť všetko
          </button>
        </div>
        <Separator className="mb-5" />
        <div className="flex-1 overflow-y-auto pr-2 pb-24">
          <FilterBody
            state={state}
            setState={setState}
            sourceCounts={sourceCounts}
            regions={regions}
          />
        </div>
        <div className="border-border/40 bg-background/95 sticky bottom-0 -mx-1 border-t px-1 py-3 backdrop-blur">
          <Button onClick={applyNow} className="w-full" size="lg">
            Použiť filter
          </Button>
        </div>
      </aside>
    </>
  );
}
