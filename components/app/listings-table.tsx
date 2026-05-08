import type { SimilarListing } from '@/lib/mock';
import { formatEur, formatNumber } from './kpi-card';

export function ListingsTable({ listings }: { listings: SimilarListing[] }) {
  return (
    <div className="border-border/40 overflow-hidden rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-muted/30 text-muted-foreground text-xs uppercase tracking-wider">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Model</th>
            <th className="px-4 py-3 text-right font-medium">Rok</th>
            <th className="px-4 py-3 text-right font-medium">Km</th>
            <th className="px-4 py-3 text-right font-medium">Cena</th>
            <th className="hidden px-4 py-3 text-left font-medium sm:table-cell">Región</th>
            <th className="hidden px-4 py-3 text-left font-medium md:table-cell">Zdroj</th>
            <th className="hidden px-4 py-3 text-right font-medium md:table-cell">Inzerát dní</th>
          </tr>
        </thead>
        <tbody>
          {listings.map((l) => (
            <tr key={l.id} className="border-border/40 border-t">
              <td className="px-4 py-3 font-medium">{l.modelName}</td>
              <td className="px-4 py-3 text-right tabular-nums">{l.year}</td>
              <td className="px-4 py-3 text-right tabular-nums">{formatNumber(l.mileageKm)}</td>
              <td className="px-4 py-3 text-right font-medium tabular-nums">
                {formatEur(l.priceEur)}
              </td>
              <td className="text-muted-foreground hidden px-4 py-3 sm:table-cell">{l.region}</td>
              <td className="text-muted-foreground hidden px-4 py-3 font-mono text-xs md:table-cell">
                {l.source}
              </td>
              <td className="hidden px-4 py-3 text-right tabular-nums md:table-cell">
                {l.daysListed}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
