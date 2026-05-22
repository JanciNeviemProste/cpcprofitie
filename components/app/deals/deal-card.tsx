'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DealScoreBadge } from './deal-score-badge';
import { CostCalculator } from './cost-calculator';
import type { DealCard as DealCardData } from '@/lib/db/queries/deals';

const NBSP = ' ';

function fmtEur(eur: number | null | undefined): string {
  if (eur == null) return '—';
  return `${Math.round(eur).toLocaleString('sk-SK')}${NBSP}€`;
}

function fmtKm(km: number | null): string {
  if (km == null) return '—';
  return `${km.toLocaleString('sk-SK')}${NBSP}km`;
}

function title(d: DealCardData): string {
  if (d.makeName && d.modelName) return `${d.makeName} ${d.modelName}`;
  if (d.makeName) return d.makeName;
  if (d.rawTitle) return d.rawTitle;
  return `#${d.listingId.toString()}`;
}

export function DealCard({ deal }: { deal: DealCardData }) {
  const [open, setOpen] = useState(false);
  const hot = deal.dealScore >= 80;
  const href = `/app/listings/${deal.listingId.toString()}`;

  return (
    <article
      className={cn(
        'group/dealcard relative flex flex-col overflow-hidden rounded-xl bg-card/40 ring-1 ring-foreground/10 backdrop-blur-sm transition-all hover:ring-foreground/25',
        hot && 'ring-2 ring-emerald-500/40 hover:ring-emerald-500/60',
      )}
    >
      <Link href={href} className="block">
        <div className="bg-muted relative aspect-[4/3] w-full overflow-hidden">
          {deal.heroPhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={deal.heroPhotoUrl}
              alt={title(deal)}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover/dealcard:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
              bez fotky
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          <div className="absolute right-2 top-2">
            <DealScoreBadge score={deal.dealScore} size="md" showLabel={false} />
          </div>
          <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between gap-2 text-white">
            <span className="rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider backdrop-blur-sm">
              −{Math.round(deal.discountPct)} % pod mediánom
            </span>
            {deal.confidence === 'high' ? (
              <span className="rounded-md bg-emerald-500/80 px-2 py-0.5 text-[10px] font-semibold uppercase backdrop-blur-sm">
                Istota: vysoká
              </span>
            ) : null}
          </div>
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <Link href={href} className="hover:text-primary">
          <h3 className="line-clamp-1 font-heading text-sm font-semibold">{title(deal)}</h3>
        </Link>

        <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] tabular-nums">
          {deal.year != null ? <span>{deal.year}</span> : null}
          {deal.year != null && deal.mileageKm != null ? (
            <span className="opacity-50">·</span>
          ) : null}
          {deal.mileageKm != null ? <span>{fmtKm(deal.mileageKm)}</span> : null}
          {deal.region ? (
            <>
              <span className="opacity-50">·</span>
              <span className="inline-flex items-center gap-0.5">
                <MapPin className="size-3" />
                <span className="max-w-[8rem] truncate">{deal.region}</span>
              </span>
            </>
          ) : null}
        </div>

        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xl font-bold tabular-nums">{fmtEur(deal.priceEur)}</span>
          <span className="text-muted-foreground text-[11px] tabular-nums">
            medián {fmtEur(deal.marketMedianEur)}
          </span>
        </div>

        <div className="inline-flex w-fit items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
          <span className="text-[10px] font-medium uppercase tracking-wide opacity-80">
            Profit
          </span>
          <span className="tabular-nums">+ {fmtEur(deal.estProfitEur)}</span>
        </div>

        <p className="text-muted-foreground line-clamp-2 text-[11px] leading-snug">
          {deal.explainer}
        </p>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            setOpen((v) => !v);
          }}
          className="text-primary hover:text-primary/80 mt-auto inline-flex items-center gap-1 self-start text-[11px] font-medium"
        >
          {open ? (
            <>
              Skryť kalkulačku <ChevronUp className="size-3" />
            </>
          ) : (
            <>
              Vlastný odhad <ChevronDown className="size-3" />
            </>
          )}
        </button>

        {open ? (
          <CostCalculator
            priceEur={deal.priceEur ?? 0}
            marketMedianEur={deal.marketMedianEur}
            defaultRecond={deal.estRecondEur}
          />
        ) : null}
      </div>
    </article>
  );
}
