'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { SK_KRAJE } from '@/lib/data/sk-regions';
import type { Source } from '@/lib/scraping/types';

const ALL_SOURCES: Source[] = ['autobazar.sk', 'autobazar.eu', 'bazos.sk'];

export type DealsFiltersValue = {
  minScore: number;
  sources: Source[];
  regions: string[];
  maxBudget: number | null;
};

export function DealsFilters({ initial }: { initial: DealsFiltersValue }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [minScore, setMinScore] = useState(initial.minScore);
  const [sources, setSources] = useState<Source[]>(initial.sources);
  const [regions, setRegions] = useState<string[]>(initial.regions);
  const [maxBudget, setMaxBudget] = useState<string>(
    initial.maxBudget != null ? String(initial.maxBudget) : '',
  );

  // Debounced URL sync: tweaking the slider would otherwise spam the server
  // with a navigation per pointer event. 300ms feels live without thrashing.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirst = useRef(true);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (minScore > 0) params.set('minScore', String(minScore));
    if (sources.length > 0) params.set('sources', sources.join(','));
    if (regions.length > 0) params.set('regions', regions.join(','));
    const budget = Number(maxBudget);
    if (Number.isFinite(budget) && budget > 0) params.set('maxBudget', String(Math.floor(budget)));
    return params.toString();
  }, [minScore, sources, regions, maxBudget]);

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const current = sp.toString();
      if (current === queryString) return;
      router.replace(`/app/deals${queryString ? `?${queryString}` : ''}`, { scroll: false });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [queryString, router, sp]);

  function toggleSource(s: Source) {
    setSources((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }
  function toggleRegion(r: string) {
    setRegions((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  }
  function reset() {
    setMinScore(70);
    setSources([]);
    setRegions([]);
    setMaxBudget('');
  }

  return (
    <div className="bg-card/40 border-border/40 sticky top-2 z-20 mb-6 space-y-4 rounded-xl border p-4 backdrop-blur-md">
      <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wide">
            <span className="text-muted-foreground">Min. DealScore</span>
            <span className="tabular-nums text-foreground">{minScore}</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            className="accent-primary h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border/60"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-muted-foreground block text-[11px] font-medium uppercase tracking-wide">
            Max. rozpočet (€)
          </label>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={500}
            placeholder="napr. 15000"
            value={maxBudget}
            onChange={(e) => setMaxBudget(e.target.value)}
            className="border-border/60 bg-background/60 focus:ring-primary/40 h-9 w-full rounded-md border px-3 text-sm tabular-nums outline-none focus:ring-2"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
          Zdroj
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ALL_SOURCES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggleSource(s)}
              className={cn(
                'h-7 rounded-full border px-3 text-[11px] font-medium transition-colors',
                sources.includes(s)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border/60 hover:bg-muted text-foreground',
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
          Kraj
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SK_KRAJE.map((k) => (
            <button
              key={k.name}
              type="button"
              onClick={() => toggleRegion(k.name)}
              className={cn(
                'h-7 rounded-full border px-3 text-[11px] font-medium transition-colors',
                regions.includes(k.name)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border/60 hover:bg-muted text-foreground',
              )}
            >
              {k.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={reset}
          className="text-muted-foreground hover:text-foreground text-[11px] font-medium underline-offset-2 hover:underline"
        >
          Resetovať filtre
        </button>
      </div>
    </div>
  );
}
