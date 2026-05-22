'use client';

import { Heart } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import type { ListingRow } from '@/lib/db/queries/listings';

const NBSP = ' ';

function formatPrice(eur: number | null): string {
  if (eur == null) return '—';
  return `${Math.round(eur).toLocaleString('sk-SK')}${NBSP}€`;
}

function formatKm(km: number | null): string {
  if (km == null) return null as unknown as string;
  return `${km.toLocaleString('sk-SK')}${NBSP}km`;
}

function formatFuel(fuel: string | null): string | null {
  if (!fuel) return null;
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

export function ListingCard({ row }: { row: ListingRow }) {
  const [liked, setLiked] = useState(false);
  const href = `/app/listings/${row.id.toString()}`;
  const km = formatKm(row.mileageKm);
  const fuel = formatFuel(row.fuel);
  const meta: string[] = [];
  if (row.year != null) meta.push(String(row.year));
  if (km) meta.push(km);
  if (fuel) meta.push(fuel);

  return (
    <div
      className={
        'group/card relative flex flex-col gap-3 transition-all duration-200 hover:-translate-y-1 ' +
        (row.isFeatured
          ? 'rounded-2xl p-[2px] bg-gradient-to-br from-purple-500 via-fuchsia-500 to-purple-500'
          : '')
      }
    >
      <div
        className={
          'flex flex-col gap-3 ' +
          (row.isFeatured ? 'bg-card rounded-[14px] p-2' : '')
        }
      >
        <Link
          href={href}
          className="bg-muted relative block aspect-[4/3] overflow-hidden rounded-2xl"
        >
          {row.heroPhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={row.heroPhotoUrl}
              alt={title(row)}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover/card:scale-105"
            />
          ) : (
            <div className="text-muted-foreground absolute inset-0 flex items-center justify-center text-xs">
              bez fotky
            </div>
          )}

          {/* Wishlist heart */}
          <button
            type="button"
            aria-label={liked ? 'Odstrániť z obľúbených' : 'Pridať do obľúbených'}
            aria-pressed={liked}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setLiked((v) => !v);
            }}
            className="absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-full bg-white/85 backdrop-blur-sm shadow-sm transition hover:scale-110 hover:bg-white"
          >
            <Heart
              className={
                'size-4 transition ' +
                (liked ? 'fill-rose-500 text-rose-500' : 'text-foreground')
              }
            />
          </button>

          {row.isFeatured && (
            <span className="absolute left-3 top-3 inline-flex items-center rounded-full bg-purple-600 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
              Featured
            </span>
          )}
        </Link>

        <div className="flex items-start justify-between gap-2 px-1">
          <div className="min-w-0 flex-1">
            <Link
              href={href}
              className="line-clamp-1 text-sm font-semibold transition-colors hover:underline"
            >
              {title(row)}
            </Link>
            <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
              {meta.length > 0 ? meta.join(' · ') : '—'}
            </p>
            {row.region && (
              <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
                {row.region}
              </p>
            )}
          </div>
          <div className="shrink-0 text-right">
            <div className="text-xl font-bold tabular-nums leading-tight">
              {formatPrice(row.priceEur)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
