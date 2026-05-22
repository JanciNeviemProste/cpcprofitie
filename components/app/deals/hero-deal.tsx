import Link from 'next/link';
import { MapPin, Sparkles } from 'lucide-react';
import { DealScoreBadge } from './deal-score-badge';
import type { DealCard as DealCardData } from '@/lib/db/queries/deals';

const NBSP = ' ';

function fmtEur(eur: number | null): string {
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

export function HeroDeal({ deal }: { deal: DealCardData }) {
  const href = `/app/listings/${deal.listingId.toString()}`;

  return (
    <Link
      href={href}
      className="group/herod relative mb-8 block overflow-hidden rounded-2xl ring-1 ring-foreground/10 transition-all hover:ring-foreground/25"
    >
      <div className="grid grid-cols-1 md:grid-cols-[1.1fr_1fr]">
        <div className="bg-muted relative aspect-[16/10] md:aspect-auto md:h-full md:min-h-[280px]">
          {deal.heroPhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={deal.heroPhotoUrl}
              alt={title(deal)}
              className="h-full w-full object-cover transition-transform duration-700 group-hover/herod:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
              bez fotky
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-transparent" />
          <div className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur-sm">
            <Sparkles className="size-3 text-amber-300" />
            Top deal dňa
          </div>
        </div>

        <div className="bg-card/40 relative flex flex-col gap-4 p-6 backdrop-blur-sm md:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="font-heading text-2xl font-bold leading-tight md:text-3xl">
                {title(deal)}
              </h2>
              <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs tabular-nums">
                {deal.year != null ? <span>{deal.year}</span> : null}
                {deal.year != null && deal.mileageKm != null ? <span>·</span> : null}
                {deal.mileageKm != null ? <span>{fmtKm(deal.mileageKm)}</span> : null}
                {deal.region ? (
                  <>
                    <span>·</span>
                    <span className="inline-flex items-center gap-0.5">
                      <MapPin className="size-3" />
                      {deal.region}
                    </span>
                  </>
                ) : null}
              </div>
            </div>
            <DealScoreBadge score={deal.dealScore} size="lg" />
          </div>

          <p className="text-sm leading-relaxed text-foreground/80">{deal.explainer}</p>

          <div className="border-border/40 grid grid-cols-3 gap-2 rounded-lg border bg-background/40 p-3 text-xs">
            <div>
              <div className="text-muted-foreground text-[10px] uppercase tracking-wide">
                Cena
              </div>
              <div className="text-rose-500 dark:text-rose-400 mt-0.5 text-base font-bold tabular-nums">
                {fmtEur(deal.priceEur)}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-[10px] uppercase tracking-wide">
                Trh medián
              </div>
              <div className="text-muted-foreground mt-0.5 text-base font-semibold tabular-nums">
                {fmtEur(deal.marketMedianEur)}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-[10px] uppercase tracking-wide">
                Zľava
              </div>
              <div className="mt-0.5 text-base font-bold text-emerald-500 dark:text-emerald-400 tabular-nums">
                −{Math.round(deal.discountPct)} %
              </div>
            </div>
          </div>

          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 px-4 py-2 text-sm font-bold text-emerald-600 ring-1 ring-emerald-500/40 dark:text-emerald-400">
            <span className="text-[11px] font-medium uppercase tracking-wide opacity-80">
              Očakávaný profit
            </span>
            <span className="text-lg tabular-nums">+ {fmtEur(deal.estProfitEur)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
