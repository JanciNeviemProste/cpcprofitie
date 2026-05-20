import Link from 'next/link';
import type { TrendRow } from '@/lib/db/queries/trends';
import { WowArrow } from './wow-arrow';

const NBSP = ' ';

function fmtPrice(eur: number | null): string {
  if (eur == null) return '—';
  return `${eur.toLocaleString('sk-SK')}${NBSP}€`;
}

function fmtCount(n: number | null): string {
  if (n == null) return '—';
  return n.toLocaleString('sk-SK');
}

function fmtDays(d: number | null): string {
  if (d == null) return '—';
  return `${Math.round(d)}${NBSP}dní`;
}

export function TrendsTable({ rows }: { rows: TrendRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="border-border/60 rounded-lg border p-10 text-center">
        <p className="text-muted-foreground text-sm">
          Žiadne dáta. Snapshoty sa generujú týždenne — počkajte na prvý beh weekly cron-u.
        </p>
      </div>
    );
  }
  return (
    <div className="border-border/60 overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/30 border-border/40 border-b text-xs uppercase">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Model</th>
            <th className="px-4 py-3 text-right font-medium">Aktívne</th>
            <th className="px-4 py-3 text-right font-medium">WoW</th>
            <th className="px-4 py-3 text-right font-medium">Predané (7d)</th>
            <th className="px-4 py-3 text-right font-medium">Medián ceny</th>
            <th className="px-4 py-3 text-right font-medium">Δ cena</th>
            <th className="px-4 py-3 text-right font-medium">Days-to-sell</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.modelId}
              className="border-border/30 hover:bg-muted/20 border-b transition-colors last:border-b-0"
            >
              <td className="px-4 py-3">
                <Link
                  href={`/app/trends/${r.makeSlug}-${r.modelSlug}`}
                  className="hover:text-primary font-medium"
                >
                  {r.modelName}
                </Link>
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{fmtCount(r.countActive)}</td>
              <td className="px-4 py-3 text-right">
                <WowArrow current={r.countActive} previous={r.countActiveLastWeek} />
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {fmtCount(r.countSoldThisWeek)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {fmtPrice(r.medianPriceEur)}
              </td>
              <td className="px-4 py-3 text-right">
                <WowArrow current={r.medianPriceEur} previous={r.medianLastWeekEur} invert />
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {fmtDays(r.daysToSellAvg)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
