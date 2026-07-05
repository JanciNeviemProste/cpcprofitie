'use client';

import { Checkbox } from '@base-ui/react/checkbox';
import { Dialog } from '@base-ui/react/dialog';
import { Slider } from '@base-ui/react/slider';
import { Check, Search, SlidersHorizontal, X } from 'lucide-react';
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
  if (state.minYear != null && state.minYear !== YEAR_MIN) p.set('minYear', String(state.minYear));
  if (state.maxYear != null && state.maxYear !== YEAR_MAX) p.set('maxYear', String(state.maxYear));
  if (state.minKm != null && state.minKm !== KM_MIN) p.set('minKm', String(state.minKm));
  if (state.maxKm != null && state.maxKm !== KM_MAX) p.set('maxKm', String(state.maxKm));
  if (state.hasPhoto) p.set('hasPhoto', '1');
  if (state.featuredOnly) p.set('featuredOnly', '1');
  if (state.sort && state.sort !== 'newest') p.set('sort', state.sort);
  return p;
}

function countActiveFilters(s: InitialFilters): number {
  let n = 0;
  if (s.sources.length > 0) n++;
  if (s.fuel.length > 0) n++;
  if (s.regions.length > 0) n++;
  if (s.minPrice != null || s.maxPrice != null) n++;
  if (s.minYear != null || s.maxYear != null) n++;
  if (s.minKm != null || s.maxKm != null) n++;
  if (s.hasPhoto) n++;
  if (s.featuredOnly) n++;
  return n;
}

function RangeRow({
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
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.14em]">
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
          <Slider.Track className="bg-muted/60 relative h-1.5 w-full grow overflow-hidden rounded-full">
            <Slider.Indicator className="from-primary to-primary/70 absolute h-full bg-gradient-to-r" />
          </Slider.Track>
          <Slider.Thumb className="border-primary bg-background ring-primary/30 shadow-primary/20 block size-4 rounded-full border-2 shadow-md ring-0 transition-all hover:ring-4 focus-visible:outline-none focus-visible:ring-4" />
          <Slider.Thumb className="border-primary bg-background ring-primary/30 shadow-primary/20 block size-4 rounded-full border-2 shadow-md ring-0 transition-all hover:ring-4 focus-visible:outline-none focus-visible:ring-4" />
        </Slider.Control>
      </Slider.Root>
    </div>
  );
}

function ChipPills<T extends string>({
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
              'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-all ' +
              (active
                ? 'border-primary/60 from-primary to-primary/80 text-primary-foreground bg-gradient-to-br shadow-sm'
                : 'border-border/60 bg-background/50 text-muted-foreground hover:border-primary/40 hover:text-foreground')
            }
          >
            <span>{o.label}</span>
            {count != null && (
              <span
                className={'tabular-nums ' + (active ? 'opacity-80' : 'text-muted-foreground/70')}
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

function CheckRow({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="border-border/40 bg-card/30 hover:bg-card/60 flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors">
      <Checkbox.Root
        checked={checked}
        onCheckedChange={(v) => onChange(Boolean(v))}
        className="border-border data-[checked]:border-primary data-[checked]:bg-primary flex size-5 items-center justify-center rounded-md border transition-colors"
      >
        <Checkbox.Indicator className="text-primary-foreground">
          <Check className="size-3.5" />
        </Checkbox.Indicator>
      </Checkbox.Root>
      <div className="flex-1">
        <div className="text-foreground text-sm font-medium">{label}</div>
        {hint ? <div className="text-muted-foreground text-xs">{hint}</div> : null}
      </div>
    </label>
  );
}

export function FilterSheet({ sources, regions, initialFilters }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [, startTransition] = useTransition();

  const [state, setState] = useState<InitialFilters>(initialFilters);
  const [draft, setDraft] = useState<InitialFilters>(initialFilters);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirst = useRef(true);
  const lastPushedRef = useRef<string>('');

  const sourceCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of sources) map[s.source] = s.count;
    return map;
  }, [sources]);

  const push = useCallback(
    (next: InitialFilters) => {
      const params = buildParams(next);
      const qs = params.toString();
      lastPushedRef.current = qs;
      startTransition(() => {
        router.push(qs ? `/app/listings/v1?${qs}` : '/app/listings/v1', { scroll: false });
      });
    },
    [router],
  );

  // Debounced URL sync for compact bar changes (q, sort, hasPhoto)
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

  // Sync with external URL changes (back/forward)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const current = sp.toString();
    if (current === lastPushedRef.current) return;
    setState(initialFilters);
    setDraft(initialFilters);
    isFirst.current = true;
  }, [sp.toString()]);

  // When opening sheet, seed draft from current applied state. Done as the
  // adjust-state-during-render pattern (not an effect) to avoid a cascading
  // re-render after the sheet mounts.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setDraft(state);
  }

  function toggle<T extends string>(arr: T[], v: T): T[] {
    return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
  }

  function applyDraft() {
    setState(draft);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    push(draft);
    setOpen(false);
  }

  function resetAll() {
    const cleared: InitialFilters = {
      q: '',
      sources: [],
      fuel: [],
      regions: [],
      hasPhoto: false,
      featuredOnly: false,
      sort: state.sort,
    };
    setDraft(cleared);
  }

  const activeCount = countActiveFilters(state);

  return (
    <>
      {/* Compact sticky filter bar */}
      <div className="border-border/40 bg-background/70 sticky top-16 z-20 flex flex-wrap items-center gap-2 rounded-2xl border p-2 backdrop-blur-xl">
        <div className="bg-background/60 border-border/40 flex h-9 min-w-[200px] flex-1 items-center gap-2 rounded-xl border px-3">
          <Search className="text-muted-foreground size-4 shrink-0" />
          <input
            type="search"
            value={state.q ?? ''}
            onChange={(e) => setState((s) => ({ ...s, q: e.target.value }))}
            placeholder="Hľadať (napr. Octavia)"
            className="placeholder:text-muted-foreground/60 h-full w-full bg-transparent text-sm outline-none"
          />
        </div>

        <select
          value={state.sort ?? 'newest'}
          onChange={(e) => setState((s) => ({ ...s, sort: e.target.value }))}
          className="border-border/40 bg-background/60 hover:border-border/80 h-9 cursor-pointer rounded-xl border px-3 text-sm transition-colors"
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
            'h-9 rounded-xl border px-3 text-xs font-medium transition-all ' +
            (state.hasPhoto
              ? 'border-primary/60 from-primary to-primary/80 text-primary-foreground bg-gradient-to-br'
              : 'border-border/40 bg-background/60 text-muted-foreground hover:text-foreground')
          }
        >
          S fotkou
        </button>
        <button
          type="button"
          onClick={() => setState((s) => ({ ...s, featuredOnly: !s.featuredOnly }))}
          className={
            'h-9 rounded-xl border px-3 text-xs font-medium transition-all ' +
            (state.featuredOnly
              ? 'border-amber-500/60 bg-gradient-to-br from-amber-500 to-amber-600 text-white'
              : 'border-border/40 bg-background/60 text-muted-foreground hover:text-foreground')
          }
        >
          Featured
        </button>

        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger
            render={
              <button
                type="button"
                className="border-border/40 bg-background/60 hover:border-primary/40 hover:text-foreground inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-all"
              >
                <SlidersHorizontal className="size-3.5" />
                Filtre
                {activeCount > 0 ? (
                  <span className="bg-primary text-primary-foreground inline-flex size-5 items-center justify-center rounded-full text-[10px] font-bold tabular-nums">
                    {activeCount}
                  </span>
                ) : null}
              </button>
            }
          />
          <Dialog.Portal>
            <Dialog.Backdrop className="data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-200" />
            <Dialog.Popup
              className={
                'border-border/40 bg-background/95 fixed top-0 right-0 z-50 flex h-dvh w-full flex-col border-l shadow-2xl backdrop-blur-xl ' +
                'sm:max-w-md ' +
                'data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full transition-transform duration-300 ease-out'
              }
            >
              {/* Header */}
              <div className="border-border/40 flex items-center justify-between border-b px-5 py-4">
                <div>
                  <Dialog.Title className="text-base font-semibold">Filtre</Dialog.Title>
                  <Dialog.Description className="text-muted-foreground text-xs">
                    Doladiť výsledky pomocou parametrov
                  </Dialog.Description>
                </div>
                <Dialog.Close
                  render={
                    <button
                      type="button"
                      aria-label="Zatvoriť"
                      className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-8 items-center justify-center rounded-lg transition-colors"
                    >
                      <X className="size-4" />
                    </button>
                  }
                />
              </div>

              {/* Body */}
              <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
                <div className="space-y-5">
                  <RangeRow
                    label="Cena (€)"
                    min={PRICE_MIN}
                    max={PRICE_MAX}
                    step={500}
                    value={[draft.minPrice ?? PRICE_MIN, draft.maxPrice ?? PRICE_MAX]}
                    onChange={([a, b]) =>
                      setDraft((s) => ({
                        ...s,
                        minPrice: a === PRICE_MIN ? undefined : a,
                        maxPrice: b === PRICE_MAX ? undefined : b,
                      }))
                    }
                    formatValue={(n) => `${fmt(n)} €`}
                  />
                  <RangeRow
                    label="Rok výroby"
                    min={YEAR_MIN}
                    max={YEAR_MAX}
                    step={1}
                    value={[draft.minYear ?? YEAR_MIN, draft.maxYear ?? YEAR_MAX]}
                    onChange={([a, b]) =>
                      setDraft((s) => ({
                        ...s,
                        minYear: a === YEAR_MIN ? undefined : a,
                        maxYear: b === YEAR_MAX ? undefined : b,
                      }))
                    }
                    formatValue={(n) => String(n)}
                  />
                  <RangeRow
                    label="Najazdené (km)"
                    min={KM_MIN}
                    max={KM_MAX}
                    step={5000}
                    value={[draft.minKm ?? KM_MIN, draft.maxKm ?? KM_MAX]}
                    onChange={([a, b]) =>
                      setDraft((s) => ({
                        ...s,
                        minKm: a === KM_MIN ? undefined : a,
                        maxKm: b === KM_MAX ? undefined : b,
                      }))
                    }
                    formatValue={(n) => fmt(n)}
                  />
                </div>

                <div className="space-y-2">
                  <span className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.14em]">
                    Zdroj
                  </span>
                  <ChipPills
                    options={SOURCE_OPTIONS}
                    selected={draft.sources}
                    onToggle={(v) =>
                      setDraft((s) => ({ ...s, sources: toggle(s.sources, v) }))
                    }
                    counts={sourceCounts}
                  />
                </div>

                <div className="space-y-2">
                  <span className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.14em]">
                    Palivo
                  </span>
                  <ChipPills
                    options={FUEL_OPTIONS}
                    selected={draft.fuel}
                    onToggle={(v) => setDraft((s) => ({ ...s, fuel: toggle(s.fuel, v) }))}
                  />
                </div>

                {regions.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.14em]">
                      Región
                    </span>
                    <ChipPills
                      options={regions.map((r) => ({ value: r, label: r }))}
                      selected={draft.regions}
                      onToggle={(v) =>
                        setDraft((s) => ({ ...s, regions: toggle(s.regions, v) }))
                      }
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <CheckRow
                    checked={draft.hasPhoto}
                    onChange={(v) => setDraft((s) => ({ ...s, hasPhoto: v }))}
                    label="Len s fotkou"
                    hint="Skryť inzeráty bez obrázku"
                  />
                  <CheckRow
                    checked={draft.featuredOnly}
                    onChange={(v) => setDraft((s) => ({ ...s, featuredOnly: v }))}
                    label="Iba zvýhodnené"
                    hint="Top ponuky označené Featured"
                  />
                </div>
              </div>

              {/* Sticky footer */}
              <div className="border-border/40 bg-background/95 sticky bottom-0 flex items-center gap-2 border-t px-5 py-4 backdrop-blur-xl">
                <button
                  type="button"
                  onClick={resetAll}
                  className="border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/50 h-10 flex-1 rounded-xl border text-sm font-medium transition-colors"
                >
                  Resetovať
                </button>
                <button
                  type="button"
                  onClick={applyDraft}
                  className="from-primary to-primary/80 text-primary-foreground shadow-primary/30 h-10 flex-[2] rounded-xl bg-gradient-to-br text-sm font-semibold shadow-lg transition-all hover:opacity-90"
                >
                  Použiť filtre
                </button>
              </div>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </>
  );
}
