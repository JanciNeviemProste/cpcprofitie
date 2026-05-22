'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowUpRight, ChevronDown, MapPin, Plus } from 'lucide-react';
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
  if (km >= 10000) return `${Math.round(km / 1000)}${NBSP}tis. km`;
  return `${km.toLocaleString('sk-SK')}${NBSP}km`;
}

function title(d: DealCardData): string {
  if (d.makeName && d.modelName) return `${d.makeName} ${d.modelName}`;
  if (d.makeName) return d.makeName;
  if (d.rawTitle) return d.rawTitle;
  return `#${d.listingId.toString()}`;
}

function ConfidenceBars({ level }: { level: 'low' | 'medium' | 'high' }) {
  const active = level === 'high' ? 3 : level === 'medium' ? 2 : 1;
  return (
    <div className="inline-flex items-end gap-[2px]" aria-label={`Istota ${level}`}>
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={cn(
            'w-[3px] rounded-sm transition-colors',
            i === 1 && 'h-1.5',
            i === 2 && 'h-2.5',
            i === 3 && 'h-3.5',
            i <= active
              ? level === 'high'
                ? 'bg-emerald-500'
                : level === 'medium'
                  ? 'bg-amber-500'
                  : 'bg-muted-foreground/60'
              : 'bg-foreground/15',
          )}
        />
      ))}
    </div>
  );
}

function ProfitChip({ value, large }: { value: number | null; large?: boolean }) {
  return (
    <div
      className={cn(
        'inline-flex w-fit items-baseline gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 pl-2 pr-2.5 py-1 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
        large ? 'text-base' : 'text-xs',
      )}
    >
      <ArrowUpRight className={cn('text-emerald-600 dark:text-emerald-400', large ? 'size-4' : 'size-3')} strokeWidth={2.5} />
      <span className="font-mono font-semibold tabular-nums">{fmtEur(value)}</span>
      <span className={cn('font-medium uppercase tracking-[0.16em] text-emerald-700/70 dark:text-emerald-300/70', large ? 'text-[10px]' : 'text-[9px]')}>
        profit
      </span>
    </div>
  );
}

export type DealCardSize = 'sm' | 'md' | 'lg';

export function DealCard({
  deal,
  size = 'md',
}: {
  deal: DealCardData;
  size?: DealCardSize;
}) {
  const [open, setOpen] = useState(false);
  const href = `/app/listings/${deal.listingId.toString()}`;
  const large = size === 'lg';
  const small = size === 'sm';

  return (
    <article
      className={cn(
        'group/dealcard relative flex h-full flex-col overflow-hidden rounded-2xl border border-foreground/10 bg-card/40 backdrop-blur-sm transition-all duration-300',
        'hover:-translate-y-0.5 hover:border-foreground/25 hover:shadow-[0_8px_30px_-10px_rgba(0,0,0,0.25)]',
        deal.dealScore >= 80 && 'border-emerald-500/30 hover:border-emerald-500/60',
      )}
    >
      {/* Listing index ribbon — editorial detail */}
      <Link href={href} className="block">
        <div
          className={cn(
            'bg-muted relative w-full overflow-hidden',
            large ? 'aspect-[16/10]' : small ? 'aspect-[4/3]' : 'aspect-[4/3]',
          )}
        >
          {deal.heroPhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={deal.heroPhotoUrl}
              alt={title(deal)}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover/dealcard:scale-[1.04]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
              bez fotky
            </div>
          )}

          {/* top gradient for legibility of overlays */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/55 via-black/15 to-transparent" />
          {/* bottom gradient for the discount strip */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />

          {/* Top-left: discount as ticker-style negative number */}
          <div className="absolute left-3 top-3 inline-flex items-baseline gap-1 font-mono text-white">
            <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/70">
              vs medián
            </span>
            <span className={cn('font-semibold tabular-nums', large ? 'text-lg' : 'text-base')}>
              −{Math.round(deal.discountPct)}%
            </span>
          </div>

          {/* Top-right: radial score */}
          <div className="absolute right-3 top-3">
            <div className="rounded-full bg-black/50 p-1 backdrop-blur-md ring-1 ring-white/15">
              <DealScoreBadge
                score={deal.dealScore}
                size={large ? 'md' : 'sm'}
                showLabel={false}
              />
            </div>
          </div>

          {/* Bottom-left: title overlay on large card */}
          {large ? (
            <div className="absolute inset-x-3 bottom-3 text-white">
              <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/70">
                {deal.year ?? '—'} · {fmtKm(deal.mileageKm)}
              </div>
              <h3 className="font-heading mt-0.5 line-clamp-1 text-xl font-semibold leading-tight">
                {title(deal)}
              </h3>
            </div>
          ) : null}

          {/* Bottom-right: confidence bars */}
          <div className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-black/50 px-2 py-1 backdrop-blur-md ring-1 ring-white/10">
            <ConfidenceBars level={deal.confidence} />
            <span className="text-[9px] font-medium uppercase tracking-[0.16em] text-white/80">
              {deal.confidence === 'high' ? 'istota' : deal.confidence === 'medium' ? 'stredná' : 'nízka'}
            </span>
          </div>
        </div>
      </Link>

      <div className={cn('flex flex-1 flex-col gap-2.5', large ? 'p-5' : 'p-4')}>
        {!large ? (
          <Link href={href} className="block hover:text-foreground">
            <h3
              className={cn(
                'font-heading line-clamp-1 font-semibold leading-tight',
                small ? 'text-sm' : 'text-[15px]',
              )}
            >
              {title(deal)}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {deal.year != null ? <span className="tabular-nums">{deal.year}</span> : null}
              {deal.year != null && deal.mileageKm != null ? (
                <span className="opacity-40">/</span>
              ) : null}
              {deal.mileageKm != null ? (
                <span className="tabular-nums">{fmtKm(deal.mileageKm)}</span>
              ) : null}
              {deal.region ? (
                <>
                  <span className="opacity-40">/</span>
                  <span className="inline-flex items-center gap-0.5 normal-case tracking-normal">
                    <MapPin className="size-2.5" />
                    <span className="max-w-[8rem] truncate">{deal.region}</span>
                  </span>
                </>
              ) : null}
            </div>
          </Link>
        ) : null}

        {/* Price block with mono treatment */}
        <div className="flex items-baseline justify-between gap-2 border-t border-foreground/5 pt-2.5">
          <div className="flex flex-col">
            <span className="text-[9px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              ponuka
            </span>
            <span
              className={cn(
                'font-mono font-semibold leading-none tabular-nums',
                large ? 'text-2xl' : small ? 'text-lg' : 'text-xl',
              )}
            >
              {fmtEur(deal.priceEur)}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              medián
            </span>
            <span className="font-mono text-xs leading-none text-muted-foreground tabular-nums">
              {fmtEur(deal.marketMedianEur)}
            </span>
          </div>
        </div>

        <ProfitChip value={deal.estProfitEur} large={large} />

        {!small ? (
          <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">
            {deal.explainer}
          </p>
        ) : null}

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            setOpen((v) => !v);
          }}
          aria-expanded={open}
          className={cn(
            'group/btn mt-auto inline-flex items-center justify-between gap-1.5 self-stretch rounded-md border border-foreground/10 px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground transition-colors',
            'hover:border-foreground/30 hover:bg-foreground/[0.03] hover:text-foreground',
          )}
        >
          <span className="inline-flex items-center gap-1.5">
            <Plus
              className={cn(
                'size-3 transition-transform duration-300',
                open && 'rotate-45',
              )}
            />
            {open ? 'skryť kalkulačku' : 'vlastný odhad'}
          </span>
          <ChevronDown
            className={cn(
              'size-3 transition-transform duration-300',
              open && 'rotate-180',
            )}
          />
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
