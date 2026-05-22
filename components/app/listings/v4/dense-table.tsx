import Link from 'next/link';
import type { ListingRow } from '@/lib/db/queries/listings';
import { cn } from '@/lib/utils';
import { SortHeader, type SortKey } from './sort-header';

const NBSP = ' ';

function formatPrice(eur: number | null): string {
  if (eur == null) return '—';
  return `${Math.round(eur).toLocaleString('sk-SK')}${NBSP}€`;
}

function formatKm(km: number | null): string {
  if (km == null) return '—';
  if (km >= 1000) return `${Math.round(km / 1000)}k`;
  return km.toLocaleString('sk-SK');
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

function title(row: ListingRow): string {
  if (row.rawTitle) return row.rawTitle;
  if (row.makeName && row.modelName) return `${row.makeName} ${row.modelName}`;
  if (row.makeName) return row.makeName;
  return `#${row.sourceId}`;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

type Props = {
  rows: ListingRow[];
  sort: SortKey;
  searchParams: Record<string, string | string[] | undefined>;
};

export function V4DenseTable({ rows, sort, searchParams }: Props) {
  if (rows.length === 0) {
    return (
      <div className="border-border/60 rounded-lg border p-12 text-center text-sm text-muted-foreground">
        Žiadne inzeráty pre tento filter.
      </div>
    );
  }

  // Compute median price across visible rows for delta column.
  const prices = rows
    .map((r) => r.priceEur)
    .filter((p): p is number => p != null);
  const med = median(prices);

  return (
    <div className="border-border/60 overflow-hidden rounded-lg border">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/70 text-muted-foreground sticky top-0 z-10 text-left text-[10px] uppercase tracking-wider shadow-md backdrop-blur">
            <tr>
              <th className="sticky left-0 z-20 bg-muted/70 px-2 py-2 w-14">Foto</th>
              <th className="sticky left-14 z-20 bg-muted/70 px-2 py-2 min-w-[180px]">
                Auto
              </th>
              <th className="px-2 py-2 text-right tabular-nums">
                <SortHeader
                  label="Rok"
                  asc="oldest"
                  desc="newest"
                  current={sort}
                  searchParams={searchParams}
                  alignRight
                />
              </th>
              <th className="px-2 py-2 text-right tabular-nums">Km</th>
              <th className="px-2 py-2">Palivo</th>
              <th className="px-2 py-2">Región</th>
              <th className="px-2 py-2">Zdroj</th>
              <th className="px-2 py-2 text-right tabular-nums">
                <SortHeader
                  label="Cena"
                  asc="price-asc"
                  desc="price-desc"
                  current={sort}
                  searchParams={searchParams}
                  alignRight
                />
              </th>
              <th
                className="px-2 py-2 text-right tabular-nums"
                title="Rozdiel oproti mediánu na stránke"
              >
                △
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              const href = `/app/listings/${r.id.toString()}`;
              const make = r.makeName;
              const model = r.modelName;
              const subtitle =
                make && model ? `${make} ${model}` : make ?? model ?? null;

              let deltaCell: React.ReactNode = (
                <span className="text-muted-foreground/40">—</span>
              );
              let deltaPct: number | null = null;
              if (med != null && r.priceEur != null && med > 0) {
                const d = r.priceEur - med;
                deltaPct = (d / med) * 100;
                const sign = d > 0 ? '+' : '';
                const colorCls =
                  d < -1000
                    ? 'text-emerald-500'
                    : d < 0
                      ? 'text-emerald-400/80'
                      : d > 1000
                        ? 'text-rose-500'
                        : d > 0
                          ? 'text-rose-400/80'
                          : 'text-muted-foreground';
                deltaCell = (
                  <span className={cn('font-mono tabular-nums', colorCls)}>
                    {sign}
                    {Math.round(deltaPct)}%
                  </span>
                );
              }

              const isUnderMedian = deltaPct != null && deltaPct < -10;

              return (
                <tr
                  key={r.id.toString()}
                  className={cn(
                    'group/row border-border/30 border-t transition-colors',
                    'hover:bg-muted/40 hover:border-l-2 hover:border-l-primary',
                    idx % 2 === 1 && 'bg-muted/10',
                  )}
                  style={{ height: '36px' }}
                >
                  <td className="sticky left-0 z-10 bg-background px-2 py-1 group-hover/row:bg-muted/40 group-[.bg-muted\/10]/row:bg-muted/10">
                    <Link
                      href={href}
                      className="bg-muted relative block h-[30px] w-10 overflow-hidden rounded"
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
                  <td className="sticky left-14 z-10 bg-background px-2 py-1 group-hover/row:bg-muted/40">
                    <div className="flex flex-col leading-tight">
                      <Link
                        href={href}
                        className="text-foreground truncate font-medium hover:text-primary"
                        title={title(r)}
                      >
                        {title(r)}
                      </Link>
                      {subtitle ? (
                        <span className="text-muted-foreground truncate text-[10px]">
                          {subtitle}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-2 py-1 text-right font-mono tabular-nums">
                    {r.year ?? '—'}
                  </td>
                  <td className="px-2 py-1 text-right font-mono tabular-nums">
                    {formatKm(r.mileageKm)}
                  </td>
                  <td className="text-muted-foreground px-2 py-1">
                    {formatFuel(r.fuel)}
                  </td>
                  <td className="text-muted-foreground truncate px-2 py-1 max-w-[140px]">
                    {r.region ?? '—'}
                  </td>
                  <td className="px-2 py-1">
                    <span className="border-border/50 text-muted-foreground rounded border px-1.5 py-0.5 font-mono text-[10px]">
                      {r.source.replace('.sk', '').replace('.eu', '')}
                    </span>
                  </td>
                  <td className="px-2 py-1 text-right">
                    <span className="text-foreground font-mono font-semibold tabular-nums">
                      {formatPrice(r.priceEur)}
                    </span>
                    {isUnderMedian && (
                      <span className="ml-1 text-[9px] text-emerald-500/80">
                        pod
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1 text-right">{deltaCell}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
