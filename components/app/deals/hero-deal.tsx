import Link from 'next/link';
import { ArrowUpRight, MapPin } from 'lucide-react';
import { DealScoreBadge } from './deal-score-badge';
import type { DealCard as DealCardData } from '@/lib/db/queries/deals';

const NBSP = ' ';

function fmtEur(eur: number | null): string {
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
    <div className="inline-flex items-end gap-[3px]" aria-label={`Istota ${level}`}>
      <span className={`h-2 w-[3px] rounded-sm ${active >= 1 ? 'bg-emerald-500' : 'bg-foreground/15'}`} />
      <span className={`h-3 w-[3px] rounded-sm ${active >= 2 ? 'bg-emerald-500' : 'bg-foreground/15'}`} />
      <span className={`h-4 w-[3px] rounded-sm ${active >= 3 ? 'bg-emerald-500' : 'bg-foreground/15'}`} />
    </div>
  );
}

export function HeroDeal({ deal }: { deal: DealCardData }) {
  const href = `/app/listings/${deal.listingId.toString()}`;

  return (
    <section className="mb-8">
      {/* Editorial section header — small caps & rule */}
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <div className="inline-flex items-baseline gap-3">
          <span className="size-1.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/15" />
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.28em] text-muted-foreground">
            Top deal · vyhodnotené teraz
          </span>
        </div>
        <span className="hidden h-px flex-1 bg-foreground/10 sm:block" />
      </div>

      <Link
        href={href}
        className="group/herod relative block overflow-hidden rounded-3xl border border-foreground/10 bg-card/40 backdrop-blur-sm transition-all duration-500 hover:-translate-y-0.5 hover:border-emerald-500/40 hover:shadow-[0_24px_60px_-20px_rgba(16,185,129,0.35)]"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12">
          {/* IMAGE — 7 cols, asymmetric */}
          <div className="relative aspect-[16/10] bg-muted lg:col-span-7 lg:aspect-auto lg:min-h-[420px]">
            {deal.heroPhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={deal.heroPhotoUrl}
                alt={title(deal)}
                className="h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover/herod:scale-[1.03]"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                bez fotky
              </div>
            )}

            {/* Gradient veil from bottom-left */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-black/70 via-black/20 to-transparent" />

            {/* Floating ticker, top-left */}
            <div className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/45 px-3 py-1.5 backdrop-blur-md">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
              <span className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-white">
                Live · DealScore {Math.round(deal.dealScore)}/100
              </span>
            </div>

            {/* Headline overlay, bottom */}
            <div className="absolute inset-x-5 bottom-5 text-white">
              <div className="font-mono text-[10px] font-medium uppercase tracking-[0.24em] text-white/70">
                {deal.year ?? '—'}
                <span className="mx-2 opacity-50">/</span>
                {fmtKm(deal.mileageKm)}
                {deal.region ? (
                  <>
                    <span className="mx-2 opacity-50">/</span>
                    <span className="inline-flex items-center gap-1 normal-case tracking-normal">
                      <MapPin className="size-3" />
                      {deal.region}
                    </span>
                  </>
                ) : null}
              </div>
              <h2 className="font-heading mt-2 text-3xl font-semibold leading-[1.05] tracking-tight sm:text-4xl lg:text-5xl">
                {title(deal)}
              </h2>
            </div>
          </div>

          {/* SIDEBAR — 5 cols, dense numerical panel */}
          <div className="relative flex flex-col gap-5 p-6 lg:col-span-5 lg:p-8">
            {/* Top row: arc + arrow */}
            <div className="flex items-start justify-between gap-4">
              <DealScoreBadge score={deal.dealScore} size="lg" />
              <div className="inline-flex size-10 items-center justify-center rounded-full border border-foreground/10 text-foreground/60 transition-colors group-hover/herod:border-emerald-500/40 group-hover/herod:text-emerald-500">
                <ArrowUpRight className="size-5" />
              </div>
            </div>

            {/* Price ledger — three-column terminal block */}
            <div className="grid grid-cols-3 divide-x divide-foreground/10 rounded-xl border border-foreground/10 bg-background/40">
              <div className="px-3 py-3">
                <div className="text-[9px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Cena
                </div>
                <div className="mt-1 font-mono text-xl font-semibold tabular-nums">
                  {fmtEur(deal.priceEur)}
                </div>
              </div>
              <div className="px-3 py-3">
                <div className="text-[9px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Medián
                </div>
                <div className="mt-1 font-mono text-xl font-semibold text-muted-foreground tabular-nums">
                  {fmtEur(deal.marketMedianEur)}
                </div>
              </div>
              <div className="px-3 py-3">
                <div className="text-[9px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Δ Zľava
                </div>
                <div className="mt-1 font-mono text-xl font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  −{Math.round(deal.discountPct)}%
                </div>
              </div>
            </div>

            {/* Headline profit — large editorial number */}
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-emerald-700/80 dark:text-emerald-300/80">
                  Odhadovaný zisk
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  istota
                  <ConfidenceBars level={deal.confidence} />
                </span>
              </div>
              <div className="mt-1 flex items-baseline gap-1.5 text-emerald-600 dark:text-emerald-400">
                <ArrowUpRight className="size-6" strokeWidth={2.5} />
                <span className="font-mono text-4xl font-semibold tabular-nums tracking-tight">
                  {fmtEur(deal.estProfitEur)}
                </span>
              </div>
              <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                kohort {deal.cohortSize} aut · po odpočítaní rekondície a poplatkov
              </div>
            </div>

            {/* Explainer — body copy */}
            <p className="text-[13px] leading-relaxed text-foreground/75">{deal.explainer}</p>

            {/* CTA hint */}
            <div className="mt-auto inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground transition-colors group-hover/herod:text-foreground">
              Otvoriť inzerát
              <ArrowUpRight className="size-3.5 transition-transform group-hover/herod:translate-x-0.5 group-hover/herod:-translate-y-0.5" />
            </div>
          </div>
        </div>
      </Link>
    </section>
  );
}
