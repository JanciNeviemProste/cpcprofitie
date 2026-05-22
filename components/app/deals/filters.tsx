'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw, SlidersHorizontal, X } from 'lucide-react';
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
  const [expanded, setExpanded] = useState(false);

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

  const activeFilterCount =
    (sources.length > 0 ? 1 : 0) +
    (regions.length > 0 ? 1 : 0) +
    (maxBudget !== '' ? 1 : 0) +
    (minScore !== 70 ? 1 : 0);

  const scorePct = Math.max(0, Math.min(100, minScore));

  return (
    <div className="sticky top-2 z-20 mb-6">
      <div className="overflow-hidden rounded-2xl border border-foreground/10 bg-background/70 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_8px_30px_-12px_rgba(0,0,0,0.25)] backdrop-blur-xl">
        {/* Primary rail — always visible */}
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap sm:gap-4">
          {/* Score slider (inline) */}
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <label
                htmlFor="minScore"
                className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground"
              >
                Min. DealScore
              </label>
              <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                {minScore}
                <span className="ml-0.5 text-[10px] text-muted-foreground">/100</span>
              </span>
            </div>
            <div className="relative mt-1.5 h-4 select-none">
              <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-foreground/10" />
              <div
                className="absolute left-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-emerald-500/40 via-emerald-500 to-emerald-400"
                style={{ width: `${scorePct}%` }}
              />
              <input
                id="minScore"
                type="range"
                min={0}
                max={100}
                step={1}
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                className="deal-filter-slider absolute inset-0 w-full cursor-pointer appearance-none bg-transparent"
              />
            </div>
          </div>

          {/* Budget */}
          <div className="flex w-full items-center gap-1 sm:w-auto">
            <div className="flex flex-col">
              <label
                htmlFor="maxBudget"
                className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground"
              >
                Max. budget
              </label>
              <div className="mt-1 flex items-baseline rounded-md border border-foreground/10 bg-background/40 px-2 focus-within:border-foreground/40">
                <input
                  id="maxBudget"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={500}
                  placeholder="—"
                  value={maxBudget}
                  onChange={(e) => setMaxBudget(e.target.value)}
                  className="h-8 w-24 bg-transparent font-mono text-sm tabular-nums outline-none placeholder:text-muted-foreground/40"
                />
                <span className="font-mono text-xs text-muted-foreground">€</span>
              </div>
            </div>
          </div>

          {/* Expand toggle */}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className={cn(
              'group inline-flex items-center gap-1.5 self-end rounded-md border border-foreground/10 px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground transition-colors',
              'hover:border-foreground/30 hover:text-foreground',
              expanded && 'border-foreground/40 bg-foreground/[0.04] text-foreground',
            )}
            aria-expanded={expanded}
          >
            <SlidersHorizontal className="size-3" />
            Filtre
            {activeFilterCount > 0 ? (
              <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500/20 px-1 text-[9px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                {activeFilterCount}
              </span>
            ) : null}
          </button>

          {activeFilterCount > 0 ? (
            <button
              type="button"
              onClick={reset}
              title="Resetovať filtre"
              className="self-end inline-flex h-7 w-7 items-center justify-center rounded-md border border-foreground/10 text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
            >
              <RotateCcw className="size-3" />
            </button>
          ) : null}
        </div>

        {/* Expanded drawer */}
        <div
          className={cn(
            'grid overflow-hidden transition-[grid-template-rows] duration-300',
            expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          )}
        >
          <div className="min-h-0">
            <div className="space-y-4 border-t border-foreground/10 px-4 py-4">
              <div>
                <div className="mb-2 font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                  Zdroj
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_SOURCES.map((s) => {
                    const active = sources.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleSource(s)}
                        className={cn(
                          'group inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-[11px] transition-all',
                          active
                            ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                            : 'border-foreground/10 text-muted-foreground hover:border-foreground/30 hover:text-foreground',
                        )}
                      >
                        {s}
                        {active ? <X className="size-3" /> : null}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="mb-2 font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                  Kraj
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {SK_KRAJE.map((k) => {
                    const active = regions.includes(k.name);
                    return (
                      <button
                        key={k.name}
                        type="button"
                        onClick={() => toggleRegion(k.name)}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition-all',
                          active
                            ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                            : 'border-foreground/10 text-muted-foreground hover:border-foreground/30 hover:text-foreground',
                        )}
                      >
                        {k.name}
                        {active ? <X className="size-3" /> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Slider thumb styling — scoped via plain style tag so it survives prerender */}
      <style jsx>{`
        :global(.deal-filter-slider)::-webkit-slider-thumb {
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 9999px;
          background: white;
          border: 1.5px solid rgba(16, 185, 129, 0.9);
          box-shadow:
            0 0 0 1px rgba(0, 0, 0, 0.08),
            0 4px 10px -2px rgba(16, 185, 129, 0.45);
          cursor: grab;
          transition: transform 0.15s ease;
        }
        :global(.deal-filter-slider)::-webkit-slider-thumb:active {
          transform: scale(1.15);
          cursor: grabbing;
        }
        :global(.deal-filter-slider)::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 9999px;
          background: white;
          border: 1.5px solid rgba(16, 185, 129, 0.9);
          cursor: grab;
        }
        :global(.dark .deal-filter-slider)::-webkit-slider-thumb {
          background: #0a0a0a;
          border-color: rgba(52, 211, 153, 0.9);
        }
      `}</style>
    </div>
  );
}
