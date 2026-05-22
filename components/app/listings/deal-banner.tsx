import { DealScoreBadge } from '@/components/app/deals/deal-score-badge';
import type { DealForListing } from '@/lib/db/queries/deals';

const NBSP = ' ';

function formatNumber(n: number): string {
  return n.toLocaleString('sk-SK');
}

type Dimension = {
  key: keyof DealForListing['scoreBreakdown'];
  label: string;
};

// computeDealScore stores each dimension as a 0-1 ratio in score_breakdown.
const DIMENSIONS: Dimension[] = [
  { key: 'discount', label: 'Zľava' },
  { key: 'cohort', label: 'Kohort' },
  { key: 'seller', label: 'Predajca' },
  { key: 'photo', label: 'Foto' },
  { key: 'recency', label: 'Čerstvosť' },
];

export function DealBanner({ deal }: { deal: DealForListing }) {
  return (
    <div className="my-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <DealScoreBadge score={deal.dealScore} size="lg" />
        <div className="flex-1">
          <p className="text-sm font-semibold">Toto je deal!</p>
          <p className="text-muted-foreground text-xs">
            {deal.explainer ||
              `${deal.discountPct.toFixed(0)}% pod mediánom, kohort ${deal.cohortSize} aut.`}
          </p>
        </div>
        <div className="text-right">
          <div className="text-muted-foreground text-xs">Odhad profit</div>
          <div className="text-xl font-bold text-emerald-500 tabular-nums">
            +{formatNumber(deal.estProfitEur)}{NBSP}€
          </div>
        </div>
      </div>
      <details className="mt-3 text-xs">
        <summary className="text-muted-foreground hover:text-foreground cursor-pointer">
          Breakdown skóre
        </summary>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-5">
          {DIMENSIONS.map((d) => {
            const raw = deal.scoreBreakdown[d.key] ?? 0;
            const pct = Math.max(0, Math.min(100, raw * 100));
            return (
              <div key={d.key} className="space-y-1">
                <div className="text-muted-foreground flex items-center justify-between">
                  <span>{d.label}</span>
                  <span className="tabular-nums">{Math.round(pct)}%</span>
                </div>
                <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                  <div
                    className="h-full bg-emerald-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-muted-foreground mt-2 text-[11px]">
          Trh medián{NBSP}
          <span className="text-foreground font-medium tabular-nums">
            {formatNumber(deal.marketMedianEur)}{NBSP}€
          </span>
          {' · '}P25{NBSP}
          <span className="text-foreground font-medium tabular-nums">
            {formatNumber(deal.marketP25Eur)}{NBSP}€
          </span>
          {' · '}rekond.{NBSP}
          <span className="text-foreground font-medium tabular-nums">
            {formatNumber(deal.estRecondEur)}{NBSP}€
          </span>
        </p>
      </details>
    </div>
  );
}
