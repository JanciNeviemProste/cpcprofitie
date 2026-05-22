import Link from 'next/link';
import type { ListingRow } from '@/lib/db/queries/listings';

const NBSP = ' ';

function formatPrice(eur: number | null): string {
  if (eur == null) return 'Cena dohodou';
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
  if (row.makeName && row.modelName) return `${row.makeName} ${row.modelName}`;
  if (row.rawTitle) return row.rawTitle;
  if (row.makeName) return row.makeName;
  return `Inzerát #${row.sourceId}`;
}

export function EditorialCard({ row }: { row: ListingRow }) {
  const href = `/app/listings/${row.id.toString()}`;
  const subtitle = row.rawTitle && row.makeName && row.modelName ? row.rawTitle : null;

  return (
    <article className="border-border/30 group flex flex-col gap-6 border-b pb-8 sm:flex-row">
      <Link
        href={href}
        className="bg-muted relative block aspect-[4/3] w-full shrink-0 overflow-hidden rounded-xl sm:w-64"
      >
        {row.heroPhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={row.heroPhotoUrl}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="text-muted-foreground absolute inset-0 flex items-center justify-center text-xs uppercase tracking-widest">
            Bez fotky
          </div>
        )}
        {row.isFeatured ? (
          <span className="absolute left-3 top-3 rounded-full bg-amber-500/90 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
            Featured
          </span>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col">
        <div className="text-muted-foreground mb-1.5 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.15em]">
          <span>{row.source}</span>
          {row.region ? (
            <>
              <span aria-hidden>·</span>
              <span>{row.region}</span>
            </>
          ) : null}
        </div>

        <Link href={href} className="group/title">
          <h2 className="font-serif text-2xl leading-tight text-foreground decoration-foreground/30 transition-colors group-hover/title:underline group-hover/title:decoration-foreground/60">
            {title(row)}
          </h2>
        </Link>

        {subtitle ? (
          <p className="text-muted-foreground mt-1 line-clamp-2 text-sm italic">{subtitle}</p>
        ) : null}

        <dl className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
          {row.year != null ? (
            <div className="flex items-baseline gap-1.5">
              <dt className="text-[10px] uppercase tracking-wider opacity-70">Rok</dt>
              <dd className="text-foreground font-mono tabular-nums">{row.year}</dd>
            </div>
          ) : null}
          {row.mileageKm != null ? (
            <div className="flex items-baseline gap-1.5">
              <dt className="text-[10px] uppercase tracking-wider opacity-70">Km</dt>
              <dd className="text-foreground font-mono tabular-nums">{formatKm(row.mileageKm)}</dd>
            </div>
          ) : null}
          {row.fuel ? (
            <div className="flex items-baseline gap-1.5">
              <dt className="text-[10px] uppercase tracking-wider opacity-70">Palivo</dt>
              <dd className="text-foreground">{formatFuel(row.fuel)}</dd>
            </div>
          ) : null}
        </dl>

        <div className="border-border/30 mt-auto flex items-end justify-between gap-4 pt-4">
          <Link
            href={href}
            className="text-foreground/70 hover:text-foreground text-xs font-medium uppercase tracking-wider underline-offset-4 hover:underline"
          >
            Detail inzerátu →
          </Link>
          <div className="text-right">
            <div className="font-serif text-3xl font-semibold tabular-nums text-foreground">
              {formatPrice(row.priceEur)}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
