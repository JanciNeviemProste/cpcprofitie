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
              <th className="px-4 py-2.5 w-24">Foto</th>
              <th className="px-4 py-2.5">Inzerát</th>
              <th className="px-4 py-2.5 text-right">Rok</th>
              <th className="px-4 py-2.5 text-right">Km</th>
              <th className="px-4 py-2.5">Palivo</th>
              <th className="px-4 py-2.5 text-right">Cena</th>
              <th className="px-4 py-2.5">Región</th>
              <th className="px-4 py-2.5">Zdroj</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const href = `/app/listings/${r.id.toString()}`;
              const make = r.makeName;
              const model = r.modelName;
              const subtitle =
                make && model ? `${make} ${model}` : make ?? model ?? null;
              return (
                <tr
                  key={r.id.toString()}
                  className="border-border/40 hover:bg-muted/40 border-t transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={href}
                      className="bg-muted relative block aspect-[4/3] w-24 overflow-hidden rounded-lg"
                    >
                      {r.heroPhotoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.heroPhotoUrl}
                          alt=""
                          loading="lazy"
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : null}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={href}
                          className="text-foreground font-medium hover:underline"
                        >
                          {title(r)}
                        </Link>
                        {r.isFeatured ? (
                          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
                            Featured
                          </span>
                        ) : null}
                      </div>
                      {subtitle ? (
                        <span className="text-muted-foreground text-sm">{subtitle}</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.year ?? '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatKm(r.mileageKm)}</td>
                  <td className="px-4 py-3">{formatFuel(r.fuel)}</td>
                  <td className="text-foreground px-4 py-3 text-right font-semibold tabular-nums">
                    {formatPrice(r.priceEur)}
                  </td>
                  <td className="text-muted-foreground px-4 py-3">{r.region ?? '—'}</td>
                  <td className="px-4 py-3">
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
