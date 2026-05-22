'use client';

import { Checkbox } from '@base-ui/react/checkbox';
import { Popover } from '@base-ui/react/popover';
import { Slider } from '@base-ui/react/slider';
import { Check, ChevronDown } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';
import type { RawFuel, Source } from '@/lib/scraping/types';

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

type Props = {
  initialSources: Source[];
  initialFuel: RawFuel[];
  initialMinPrice?: number;
  initialMaxPrice?: number;
  initialMinYear?: number;
  initialMaxYear?: number;
  initialMinKm?: number;
  initialMaxKm?: number;
  initialFeaturedOnly: boolean;
  initialSort: string;
};

function PopoverButton({
  label,
  active,
  children,
}: {
  label: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger
        className={
          'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ' +
          (active
            ? 'border-foreground bg-foreground text-background'
            : 'border-border bg-card hover:bg-muted')
        }
      >
        {label}
        <ChevronDown className="size-3.5 opacity-70" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={6} align="start">
          <Popover.Popup className="border-border bg-popover text-popover-foreground z-50 w-[320px] origin-top rounded-2xl border p-4 shadow-xl outline-none">
            {children}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function RangeBody({
  min,
  max,
  step,
  value,
  onChange,
  format,
}: {
  min: number;
  max: number;
  step: number;
  value: [number, number];
  onChange: (v: [number, number]) => void;
  format: (n: number) => string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Od</span>
        <span className="font-semibold tabular-nums">
          {format(value[0])} – {format(value[1])}
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
          <Slider.Thumb className="border-primary bg-background block size-5 rounded-full border-2 shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40" />
          <Slider.Thumb className="border-primary bg-background block size-5 rounded-full border-2 shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40" />
        </Slider.Control>
      </Slider.Root>
    </div>
  );
}

function CheckboxRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="hover:bg-muted/60 flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm">
      <Checkbox.Root
        checked={checked}
        onCheckedChange={(v) => onChange(Boolean(v))}
        className="border-border data-[checked]:border-primary data-[checked]:bg-primary flex size-4 items-center justify-center rounded border transition-colors"
      >
        <Checkbox.Indicator className="text-primary-foreground">
          <Check className="size-3" />
        </Checkbox.Indicator>
      </Checkbox.Root>
      <span>{label}</span>
    </label>
  );
}

export function FilterBar({
  initialSources,
  initialFuel,
  initialMinPrice,
  initialMaxPrice,
  initialMinYear,
  initialMaxYear,
  initialMinKm,
  initialMaxKm,
  initialFeaturedOnly,
  initialSort,
}: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [, startTransition] = useTransition();

  const [price, setPrice] = useState<[number, number]>([
    initialMinPrice ?? PRICE_MIN,
    initialMaxPrice ?? PRICE_MAX,
  ]);
  const [year, setYear] = useState<[number, number]>([
    initialMinYear ?? YEAR_MIN,
    initialMaxYear ?? YEAR_MAX,
  ]);
  const [km, setKm] = useState<[number, number]>([
    initialMinKm ?? KM_MIN,
    initialMaxKm ?? KM_MAX,
  ]);
  const [sources, setSources] = useState<Source[]>(initialSources);
  const [fuel, setFuel] = useState<RawFuel[]>(initialFuel);
  const [featuredOnly, setFeaturedOnly] = useState(initialFeaturedOnly);
  const [sort, setSort] = useState(initialSort);

  const apply = useCallback(
    (overrides?: Partial<{
      price: [number, number];
      year: [number, number];
      km: [number, number];
      sources: Source[];
      fuel: RawFuel[];
      featuredOnly: boolean;
      sort: string;
    }>) => {
      const params = new URLSearchParams(sp.toString());
      params.delete('page');
      const p = overrides?.price ?? price;
      const y = overrides?.year ?? year;
      const k = overrides?.km ?? km;
      const s = overrides?.sources ?? sources;
      const f = overrides?.fuel ?? fuel;
      const ft = overrides?.featuredOnly ?? featuredOnly;
      const st = overrides?.sort ?? sort;

      if (p[0] !== PRICE_MIN) params.set('minPrice', String(p[0]));
      else params.delete('minPrice');
      if (p[1] !== PRICE_MAX) params.set('maxPrice', String(p[1]));
      else params.delete('maxPrice');
      if (y[0] !== YEAR_MIN) params.set('minYear', String(y[0]));
      else params.delete('minYear');
      if (y[1] !== YEAR_MAX) params.set('maxYear', String(y[1]));
      else params.delete('maxYear');
      if (k[0] !== KM_MIN) params.set('minKm', String(k[0]));
      else params.delete('minKm');
      if (k[1] !== KM_MAX) params.set('maxKm', String(k[1]));
      else params.delete('maxKm');

      if (s.length > 0) params.set('source', s.join(','));
      else params.delete('source');
      if (f.length > 0) params.set('fuel', f.join(','));
      else params.delete('fuel');
      if (ft) params.set('featuredOnly', '1');
      else params.delete('featuredOnly');
      if (st && st !== 'newest') params.set('sort', st);
      else params.delete('sort');

      const qs = params.toString();
      startTransition(() => {
        router.push(qs ? `/app/listings/v2?${qs}` : '/app/listings/v2', { scroll: false });
      });
    },
    [sp, price, year, km, sources, fuel, featuredOnly, sort, router],
  );

  function toggle<T extends string>(arr: T[], v: T): T[] {
    return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
  }

  const priceActive = price[0] !== PRICE_MIN || price[1] !== PRICE_MAX;
  const yearActive = year[0] !== YEAR_MIN || year[1] !== YEAR_MAX;
  const kmActive = km[0] !== KM_MIN || km[1] !== KM_MAX;

  return (
    <div className="-mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="flex flex-wrap items-center gap-2">
        <PopoverButton
          label={priceActive ? `${fmt(price[0])} – ${fmt(price[1])} €` : 'Cena'}
          active={priceActive}
        >
          <RangeBody
            min={PRICE_MIN}
            max={PRICE_MAX}
            step={500}
            value={price}
            onChange={(v) => {
              setPrice(v);
              apply({ price: v });
            }}
            format={(n) => `${fmt(n)} €`}
          />
        </PopoverButton>

        <PopoverButton
          label={yearActive ? `${year[0]} – ${year[1]}` : 'Rok'}
          active={yearActive}
        >
          <RangeBody
            min={YEAR_MIN}
            max={YEAR_MAX}
            step={1}
            value={year}
            onChange={(v) => {
              setYear(v);
              apply({ year: v });
            }}
            format={(n) => String(n)}
          />
        </PopoverButton>

        <PopoverButton
          label={kmActive ? `${fmt(km[0])} – ${fmt(km[1])} km` : 'Km'}
          active={kmActive}
        >
          <RangeBody
            min={KM_MIN}
            max={KM_MAX}
            step={5000}
            value={km}
            onChange={(v) => {
              setKm(v);
              apply({ km: v });
            }}
            format={(n) => fmt(n)}
          />
        </PopoverButton>

        <PopoverButton
          label={fuel.length > 0 ? `Palivo (${fuel.length})` : 'Palivo'}
          active={fuel.length > 0}
        >
          <div className="flex flex-col gap-0.5">
            {FUEL_OPTIONS.map((o) => (
              <CheckboxRow
                key={o.value}
                checked={fuel.includes(o.value)}
                onChange={() => {
                  const next = toggle(fuel, o.value);
                  setFuel(next);
                  apply({ fuel: next });
                }}
                label={o.label}
              />
            ))}
          </div>
        </PopoverButton>

        <PopoverButton
          label={sources.length > 0 ? `Zdroj (${sources.length})` : 'Zdroj'}
          active={sources.length > 0}
        >
          <div className="flex flex-col gap-0.5">
            {SOURCE_OPTIONS.map((o) => (
              <CheckboxRow
                key={o.value}
                checked={sources.includes(o.value)}
                onChange={() => {
                  const next = toggle(sources, o.value);
                  setSources(next);
                  apply({ sources: next });
                }}
                label={o.label}
              />
            ))}
          </div>
        </PopoverButton>

        <button
          type="button"
          onClick={() => {
            const next = !featuredOnly;
            setFeaturedOnly(next);
            apply({ featuredOnly: next });
          }}
          className={
            'inline-flex h-10 shrink-0 items-center rounded-full border px-4 text-sm font-medium transition ' +
            (featuredOnly
              ? 'border-purple-500 bg-purple-500 text-white'
              : 'border-border bg-card hover:bg-muted')
          }
        >
          ★ Featured
        </button>

        <div className="ml-auto">
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              apply({ sort: e.target.value });
            }}
            aria-label="Zoradiť"
            className="border-border bg-card hover:bg-muted h-10 cursor-pointer rounded-full border px-4 text-sm font-medium outline-none transition"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
