import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';

type Trend = 'up' | 'down' | 'flat';

export function KpiCard({
  label,
  value,
  hint,
  trend,
  delta,
}: {
  label: string;
  value: string;
  hint?: string;
  trend?: Trend;
  delta?: string;
}) {
  const TrendIcon = trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownRight : Minus;
  const trendColor =
    trend === 'up'
      ? 'text-chart-3'
      : trend === 'down'
        ? 'text-destructive'
        : 'text-muted-foreground';

  return (
    <div className="border-border/40 bg-card/40 rounded-xl border p-5">
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tracking-tight">{value}</span>
        {delta && (
          <span className={`flex items-center gap-0.5 text-xs font-medium ${trendColor}`}>
            <TrendIcon className="size-3" />
            {delta}
          </span>
        )}
      </div>
      {hint && <p className="text-muted-foreground mt-1 text-xs">{hint}</p>}
    </div>
  );
}

export function formatEur(value: number) {
  return new Intl.NumberFormat('sk-SK', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat('sk-SK').format(value);
}

export function formatPct(value: number) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)} %`;
}
