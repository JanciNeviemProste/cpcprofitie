'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

const NBSP = ' ';

function fmtEur(eur: number): string {
  const sign = eur >= 0 ? '+' : '−';
  return `${sign}${NBSP}${Math.abs(Math.round(eur)).toLocaleString('sk-SK')}${NBSP}€`;
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

  // Live profit model: median - price - recond - holding-cost (100 € / mo)
  // - 5% fees on the sale price. Holding cost approximates parking + capital
  // tied up; user can dial it via the days slider.
  const fees = Math.round(marketMedianEur * 0.05);
  const holding = Math.round((days / 30) * 100);
  const profit = marketMedianEur - priceEur - recond - holding - fees;
  const positive = profit >= 0;

  return (
    <div className="bg-muted/30 border-border/40 mt-3 space-y-3 rounded-lg border p-3">
      <div className="space-y-1.5">
        <label className="text-muted-foreground flex items-center justify-between text-[11px] font-medium uppercase tracking-wide">
          <span>Rekondícia</span>
          <span className="tabular-nums text-foreground">{recond.toLocaleString('sk-SK')} €</span>
        </label>
        <input
          type="range"
          min={0}
          max={3000}
          step={50}
          value={recond}
          onChange={(e) => setRecond(Number(e.target.value))}
          className="accent-primary h-1 w-full cursor-pointer appearance-none rounded-full bg-border/60"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-muted-foreground flex items-center justify-between text-[11px] font-medium uppercase tracking-wide">
          <span>Čas predaja</span>
          <span className="tabular-nums text-foreground">{days} dní</span>
        </label>
        <input
          type="range"
          min={14}
          max={90}
          step={1}
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="accent-primary h-1 w-full cursor-pointer appearance-none rounded-full bg-border/60"
        />
      </div>
      <div className="text-muted-foreground flex justify-between text-[10px] tabular-nums">
        <span>Poplatky 5 % · {fees.toLocaleString('sk-SK')} €</span>
        <span>Držanie · {holding.toLocaleString('sk-SK')} €</span>
      </div>
      <div
        className={cn(
          'rounded-md border px-3 py-2 text-center text-sm font-semibold tabular-nums',
          positive
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400'
            : 'border-rose-500/30 bg-rose-500/10 text-rose-500 dark:text-rose-400',
        )}
      >
        <span className="text-muted-foreground mr-1.5 text-[11px] font-normal uppercase tracking-wide">
          Profit
        </span>
        {fmtEur(profit)}
      </div>
    </div>
  );
}
