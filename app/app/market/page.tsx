import Link from 'next/link';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { formatEur, formatNumber, formatPct } from '@/components/app/kpi-card';
import { mockTrending } from '@/lib/mock';

export const metadata = { title: 'Trh' };

export default function MarketPage() {
  const trending = mockTrending().sort((a, b) => b.countActive - a.countActive);

  return (
    <div className="container mx-auto px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Trh</h1>
        <p className="text-muted-foreground text-sm">
          Všetky sledované modely zoradené podľa likvidity. Klikom otvoríte detailnú analýzu.
        </p>
      </div>

      <div className="border-border/40 mt-8 overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-muted-foreground text-xs uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Model</th>
              <th className="px-4 py-3 text-right font-medium">Aktívne</th>
              <th className="px-4 py-3 text-right font-medium">Medián</th>
              <th className="px-4 py-3 text-right font-medium">Týždeň</th>
            </tr>
          </thead>
          <tbody>
            {trending.map((t) => {
              const TrendIcon = t.changePct >= 0 ? ArrowUpRight : ArrowDownRight;
              const trendColor = t.changePct >= 0 ? 'text-chart-3' : 'text-destructive';
              return (
                <tr key={t.modelSlug} className="border-border/40 hover:bg-muted/20 border-t">
                  <td className="px-4 py-3">
                    <Link
                      href={`/app/analysis/${t.modelSlug}`}
                      className="hover:text-primary font-medium"
                    >
                      {t.modelName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatNumber(t.countActive)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatEur(t.median)}</td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`flex items-center justify-end gap-0.5 font-medium tabular-nums ${trendColor}`}
                    >
                      <TrendIcon className="size-3" />
                      {formatPct(t.changePct)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
