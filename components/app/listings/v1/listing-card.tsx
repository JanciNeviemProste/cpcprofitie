import Link from 'next/link';
import { Calendar, Fuel, Gauge, MapPin } from 'lucide-react';
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

function title(row: ListingRow): string {
  if (row.rawTitle) return row.rawTitle;
  if (row.makeName && row.modelName) return `${row.makeName} ${row.modelName}`;
  if (row.makeName) return row.makeName;
  return `Inzerát #${row.sourceId}`;
}

export function ListingCard({ row }: { row: ListingRow }) {
  const href = `/app/listings/${row.id.toString()}`;
  const make = row.makeName;
  const model = row.modelName;
  const subtitle = make && model ? `${make} ${model}` : (make ?? model ?? null);

  return (
    <Link
      href={href}
      className="border-border/40 bg-card/40 hover:bg-card/70 hover:border-border/80 group/card relative flex flex-col gap-4 overflow-hidden rounded-xl border p-3 backdrop-blur-sm transition-all hover:-translate-y-px hover:shadow-lg sm:flex-row sm:items-stretch sm:gap-4 sm:p-3"
    >
      {/* Thumbnail */}
      <div className="bg-muted relative aspect-[4/3] w-full overflow-hidden rounded-lg sm:aspect-square sm:size-28 sm:shrink-0">
        {row.heroPhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={row.heroPhotoUrl}
            alt=""
            loading="lazy"
            className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover/card:scale-105"
          />
        ) : (
          <div className="text-muted-foreground/40 absolute inset-0 flex items-center justify-center text-xs">
            bez fotky
          </div>
        )}
        {row.isFeatured ? (
          <span className="absolute top-1.5 left-1.5 rounded-full border border-amber-500/40 bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-300 backdrop-blur">
            Featured
          </span>
        ) : null}
      </div>

      {/* Body */}
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
        <div className="min-w-0">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-foreground line-clamp-1 text-sm font-semibold sm:text-base">
                {title(row)}
              </h3>
              {subtitle ? (
                <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">{subtitle}</p>
              ) : null}
            </div>
            <div className="text-right">
              <div className="from-primary to-foreground bg-gradient-to-br bg-clip-text text-lg font-bold tabular-nums text-transparent sm:text-xl">
                {formatPrice(row.priceEur)}
              </div>
            </div>
          </div>
        </div>

        <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums">
          {row.year != null && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="size-3" />
              {row.year}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Gauge className="size-3" />
            {formatKm(row.mileageKm)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Fuel className="size-3" />
            {formatFuel(row.fuel)}
          </span>
          {row.region ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" />
              {row.region}
            </span>
          ) : null}
          <span className="border-border/40 ml-auto inline-flex h-5 items-center rounded-full border px-2 text-[10px] uppercase tracking-wide">
            {row.source}
          </span>
        </div>
      </div>
    </Link>
  );
}
