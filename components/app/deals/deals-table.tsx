import Link from 'next/link';
import type { DealRow } from '@/lib/db/queries/trends';
import { ConfidenceBadge } from './confidence-badge';

const NBSP = ' ';

function fmtPrice(eur: number | null): string {
  if (eur == null) return '—';
  return `${eur.toLocaleString('sk-SK')}${NBSP}€`;
}

function fmtKm(km: number | null): string {
  if (km == null) return '—';
  return `${km.toLocaleString('sk-SK')}${NBSP}km`;
}

function title(d: DealRow): string {
  if (d.makeName && d.modelName) return `${d.makeName} ${d.modelName}`;
  if (d.makeName) return d.makeName;
  return `#${d.listingId.toString()}`;
}

export function DealsTable({ rows }: { rows: DealRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="border-border/60 rounded-lg border p-10 text-center">
        <p className="text-muted-foreground text-sm">
          Žiadne aktívne deals. Buď trh nie je podhodnotený, alebo weekly cron ešte
          neprepočítal flip_opportunities. Skúste neskôr.
        </p>
      </div>
    );
  }
  return (
    <div className="border-border/60 overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/30 border-border/40 border-b text-xs uppercase">
          <tr>
            <th className="px-3 py-3 text-left font-medium">Foto</th>
            <th className="px-3 py-3 text-left font-medium">Auto</th>
            <th className="px-3 py-3 text-right font-medium">Rok</th>
            <th className="px-3 py-3 text-right font-medium">Najazd.</th>
            <th className="px-3 py-3 text-right font-medium">Cena</th>
            <th className="px-3 py-3 text-right font-medium">Trh medián</th>
            <th className="px-3 py-3 text-right font-medium">Zisk</th>
            <th className="px-3 py-3 text-right font-medium">Zľava</th>
            <th className="px-3 py-3 text-left font-medium">Región</th>
            <th className="px-3 py-3 text-left font-medium">Istota</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.listingId.toString()}
              className="border-border/30 hover:bg-muted/20 border-b transition-colors last:border-b-0"
            >
              <td className="px-3 py-2">
                <Link
                  href={`/app/listings/${r.listingId.toString()}`}
                  className="block size-12 overflow-hidden rounded-md"
                >
                  {r.heroPhotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.heroPhotoUrl}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="bg-muted h-full w-full" />
                  )}
                </Link>
              </td>
              <td className="px-3 py-2">
                <Link
                  href={`/app/listings/${r.listingId.toString()}`}
                  className="hover:text-primary font-medium"
                >
                  {title(r)}
                </Link>
                <div className="text-muted-foreground text-[11px]">{r.source}</div>
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{r.year ?? '—'}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtKm(r.mileageKm)}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                <span className="text-rose-600 dark:text-rose-400 font-semibold">
                  {fmtPrice(r.priceEur)}
                </span>
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                {fmtPrice(r.marketMedianEur)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  +{fmtPrice(r.potentialGainEur)}
                </span>
              </td>
              <td className="px-3 py-2 text-right">
                <span className="inline-flex items-center rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  −{r.discountPct.toFixed(0)}%
                </span>
              </td>
              <td className="px-3 py-2 text-xs">{r.region ?? '—'}</td>
              <td className="px-3 py-2">
                <ConfidenceBadge level={r.confidence} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
