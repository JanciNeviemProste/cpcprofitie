'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

const NBSP = ' ';

function fmtEur(eur: number): string {
  const sign = eur >= 0 ? '+' : '−';
  return `${sign}${NBSP}${Math.abs(Math.round(eur)).toLocaleString('sk-SK')}${NBSP}€`;
}

function fmtPlain(n: number): string {
  return Math.round(n).toLocaleString('sk-SK');
}

function PremiumSlider({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
}) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono tabular-nums text-foreground">{display}</span>
      </div>
      <div className="relative h-5 select-none">
        {/* Tick marks under the track add the "instrument" feel. */}
        <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-between px-[1px]">
          {Array.from({ length: 21 }).map((_, i) => (
            <span
              key={i}
              className={cn(
                'h-1 w-px bg-foreground/15',
                i % 5 === 0 && 'h-1.5 bg-foreground/25',
              )}
            />
          ))}
        </div>
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-foreground/10" />
        <div
          className="absolute top-1/2 h-px -translate-y-1/2 bg-emerald-500/70"
          style={{ width: `${pct}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
          className="deal-slider absolute inset-0 w-full cursor-pointer appearance-none bg-transparent"
        />
      </div>
    </div>
  );
}

export function CostCalculator({
  priceEur,
  marketMedianEur,
  defaultRecond,
}: {
  priceEur: number;
  marketMedianEur: number;
  defaultRecond: number;
}) {
  const [recond, setRecond] = useState(defaultRecond);
  const [days, setDays] = useState(30);

  const fees = Math.round(marketMedianEur * 0.05);
  const holding = Math.round((days / 30) * 100);
  const profit = marketMedianEur - priceEur - recond - holding - fees;
  const positive = profit >= 0;

  return (
    <div className="deal-calc-slide mt-3 overflow-hidden rounded-lg border border-foreground/10 bg-background/60 backdrop-blur-sm">
      <style jsx>{`
        :global(.deal-calc-slide) {
          animation: deal-calc-slide-down 220ms cubic-bezier(0.2, 0.7, 0.2, 1) both;
        }
        @keyframes deal-calc-slide-down {
          from {
            opacity: 0;
            transform: translateY(-4px);
            max-height: 0;
          }
          to {
            opacity: 1;
            transform: translateY(0);
            max-height: 400px;
          }
        }
        :global(.deal-slider)::-webkit-slider-thumb {
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
        :global(.deal-slider)::-webkit-slider-thumb:active {
          transform: scale(1.15);
          cursor: grabbing;
        }
        :global(.deal-slider)::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 9999px;
          background: white;
          border: 1.5px solid rgba(16, 185, 129, 0.9);
          cursor: grab;
        }
        :global(.dark .deal-slider)::-webkit-slider-thumb {
          background: #0a0a0a;
          border-color: rgba(52, 211, 153, 0.9);
        }
      `}</style>

      <div className="space-y-4 p-3.5">
        <PremiumSlider
          label="Rekondícia"
          value={recond}
          display={`${recond.toLocaleString('sk-SK')} €`}
          min={0}
          max={3000}
          step={50}
          onChange={setRecond}
        />
        <PremiumSlider
          label="Čas predaja"
          value={days}
          display={`${days} dní`}
          min={14}
          max={90}
          step={1}
          onChange={setDays}
        />

        <div className="grid grid-cols-2 gap-2 border-y border-foreground/10 py-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          <div className="flex items-baseline justify-between">
            <span>Poplatky 5%</span>
            <span className="font-mono tabular-nums text-foreground/80">
              {fmtPlain(fees)} €
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span>Držanie</span>
            <span className="font-mono tabular-nums text-foreground/80">
              {fmtPlain(holding)} €
            </span>
          </div>
        </div>

        <div
          className={cn(
            'flex items-baseline justify-between px-1',
            positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
          )}
        >
          <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Net profit
          </span>
          <span className="font-mono text-xl font-semibold tabular-nums">{fmtEur(profit)}</span>
        </div>
      </div>
    </div>
  );
}
