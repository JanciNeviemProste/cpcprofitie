import Link from 'next/link';
import type { ListingRow } from '@/lib/db/queries/listings';

const NBSP = ' ';

function formatPrice(eur: number | null): string {
  if (eur == null) return '—';
  return `${Math.round(eur).toLocaleString('sk-SK')}${NBSP}€`;
}

function formatKm(km: number | null): string {
  if (km == null) return '—';
  return `${km.toLocaleString('sk-SK')}${NBSP}km`;
}

function formatFuel(fuel: string | null): string {
  if (!fuel) return '—';
  const map: Record<string, string> = {
    gasoline: 'Benzín',
    diesel: 'Diesel',
    hybrid: 'Hybrid',
    phev: 'PHEV',
    electric: 'Elektro',
    lpg: 'LPG',
    cng: 'CNG',
    other: 'Iné',
  };
  return map[fuel] ?? fuel;
}

function sourceBadge(source: string): string {
  return source;
}

function title(row: ListingRow): string {
  if (row.rawTitle) return row.rawTitle;
  if (row.makeName && row.modelName) return `${row.makeName} ${row.modelName}`;
  if (row.makeName) return row.makeName;
  return `Inzerát #${row.sourceId}`;
}

export function ListingsTable({ rows }: { rows: ListingRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="border-border/60 rounded-lg border p-12 text-center text-sm text-muted-foreground">
        Žiadne inzeráty pre tento filter.
      </div>
    );
  }

  return (
    <div className="border-border/60 overflow-hidden rounded-lg border">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-muted-foreground sticky top-0 z-10 text-left text-xs uppercase backdrop-blur">
            <tr>
              <th className="px-3 py-2 w-24">Foto</th>
              <th className="px-3 py-2">Inzerát</th>
              <th className="px-3 py-2 text-right">Rok</th>
              <th className="px-3 py-2 text-right">Km</th>
              <th className="px-3 py-2">Palivo</th>
              <th className="px-3 py-2 text-right">Cena</th>
              <th className="px-3 py-2">Región</th>
              <th className="px-3 py-2">Zdroj</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const href = `/app/listings/${r.id.toString()}`;
              return (
                <tr
                  key={r.id.toString()}
                  className="border-border/40 even:bg-muted/10 hover:bg-muted/30 border-t transition-colors"
                >
                  <td className="px-3 py-2">
                    <Link href={href}>
                      {r.heroPhotoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.heroPhotoUrl}
                          alt=""
                          loading="lazy"
                          width={96}
                          height={64}
                          className="border-border/40 h-16 w-24 rounded-md border object-cover"
                        />
                      ) : (
                        <div className="border-border/40 bg-muted h-16 w-24 rounded-md border" />
                      )}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <Link href={href} className="font-medium hover:underline">
                      {title(r)}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.year ?? '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatKm(r.mileageKm)}</td>
                  <td className="px-3 py-2">{formatFuel(r.fuel)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">
                    {formatPrice(r.priceEur)}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{r.region ?? '—'}</td>
                  <td className="px-3 py-2">
                    <span className="border-border/60 text-muted-foreground rounded border px-2 py-0.5 text-xs">
                      {sourceBadge(r.source)}
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
