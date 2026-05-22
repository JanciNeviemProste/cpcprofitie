import Link from 'next/link';
import { DealScoreBadge } from '@/components/app/deals/deal-score-badge';
import type { DealCard } from '@/lib/db/queries/deals';

const NBSP = ' ';

function fmtPrice(eur: number | null): string {
  if (eur == null) return '—';
  return `${eur.toLocaleString('sk-SK')}${NBSP}€`;
}

function fmtKm(km: number | null): string {
  if (km == null) return '—';
  return `${km.toLocaleString('sk-SK')}${NBSP}km`;
}

function title(d: DealCard): string {
  if (d.rawTitle) return d.rawTitle;
  if (d.makeName && d.modelName) return `${d.makeName} ${d.modelName}`;
  if (d.makeName) return d.makeName;
  return `Inzerát #${d.listingId.toString()}`;
}

export function FeaturedDealCard({ deal }: { deal: DealCard }) {
  return (
    <Link
      href={`/app/listings/${deal.listingId.toString()}`}
      className="border-border/60 hover:border-primary/40 group relative flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-colors"
    >
      <div className="bg-muted relative aspect-[4/3] w-full overflow-hidden">
        {deal.heroPhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={deal.heroPhotoUrl}
            alt={title(deal)}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="text-muted-foreground flex h-full w-full items-center justify-center text-xs">
            Bez fotky
          </div>
        )}
        <div className="absolute right-2 top-2">
          <DealScoreBadge score={deal.dealScore} size="sm" />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div>
          <h3 className="line-clamp-1 text-sm font-semibold">{title(deal)}</h3>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {deal.year ?? '—'} · {fmtKm(deal.mileageKm)}
            {deal.region ? ` · ${deal.region}` : ''}
          </p>
        </div>
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div>
            <div className="text-muted-foreground text-[11px]">Cena</div>
            <div className="text-base font-bold tabular-nums">
              {fmtPrice(deal.priceEur)}
            </div>
          </div>
          <span className="inline-flex items-center rounded-md bg-emerald-500/15 px-2 py-1 text-xs font-semibold text-emerald-600 tabular-nums dark:text-emerald-400">
            +{fmtPrice(deal.estProfitEur)}
          </span>
        </div>
      </div>
    </Link>
  );
}
