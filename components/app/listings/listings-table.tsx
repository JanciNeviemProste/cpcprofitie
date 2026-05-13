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
          <thead className="bg-muted/40 text-muted-foreground text-left text-xs uppercase">
            <tr>
              <th className="px-3 py-2 w-20">Foto</th>
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
                <tr key={r.id.toString()} className="border-border/40 hover:bg-muted/20 border-t">
                  <td className="px-3 py-2">
                    <Link href={href}>
                      {r.heroPhotoUrl ? (
                        // Use plain <img> — many CDN URLs are tokenised + expire,
                        // so we can't reliably re-fetch via next/image edge optimisation.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.heroPhotoUrl}
                          alt=""
                          loading="lazy"
                          width={80}
                          height={56}
                          className="border-border/40 h-14 w-20 rounded-sm border object-cover"
                        />
                      ) : (
                        <div className="border-border/40 bg-muted h-14 w-20 rounded-sm border" />
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
