import Link from 'next/link';
import { Plus } from 'lucide-react';
import { formatEur, formatNumber } from '@/components/app/kpi-card';
import { mockGarage } from '@/lib/mock';

export const metadata = { title: 'Moja garáž' };

export default function GaragePage() {
  const cars = mockGarage();

  return (
    <div className="container mx-auto px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Moja garáž</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Sledujte cenovú pozíciu vlastných vozidiel voči trhu.
          </p>
        </div>
        <button className="border-primary/40 bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium">
          <Plus className="size-4" />
          Pridať vozidlo
        </button>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cars.map((car) => {
          const expectedSale = car.marketMedianEur;
          const margin = expectedSale - car.purchasePriceEur;
          const onTarget = margin >= car.targetMarginEur;
          return (
            <article
              key={car.id}
              className="border-border/40 bg-card/30 rounded-xl border p-5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-muted-foreground text-xs">{car.year}</p>
                  <h2 className="text-base font-semibold tracking-tight">{car.modelName}</h2>
                </div>
                <span
                  className={
                    onTarget
                      ? 'bg-chart-3/15 text-chart-3 rounded-md px-2 py-0.5 text-xs font-medium'
                      : 'bg-destructive/15 text-destructive rounded-md px-2 py-0.5 text-xs font-medium'
                  }
                >
                  {onTarget ? 'Na cieli' : 'Pod cieľom'}
                </span>
              </div>

              <dl className="mt-4 space-y-2 text-sm">
                <Row label="Najazdené" value={`${formatNumber(car.mileageKm)} km`} />
                <Row label="Nákupná cena" value={formatEur(car.purchasePriceEur)} />
                <Row label="Trhový medián" value={formatEur(car.marketMedianEur)} />
                <Row
                  label="Očakávaná marža"
                  value={formatEur(margin)}
                  tone={margin > 0 ? 'positive' : 'negative'}
                />
                <Row label="Cieľová marža" value={formatEur(car.targetMarginEur)} muted />
              </dl>

              <Link
                href={`/app/analysis/${car.modelSlug}`}
                className="text-primary mt-4 inline-block text-xs hover:underline"
              >
                Pozrieť trhovú analýzu →
              </Link>
            </article>
          );
        })}

        <button className="border-border/60 hover:border-primary/40 hover:bg-muted/30 group flex min-h-[280px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-sm transition-colors">
          <Plus className="text-muted-foreground group-hover:text-primary size-6" />
          <span className="text-muted-foreground group-hover:text-foreground font-medium">
            Pridať ďalšie vozidlo
          </span>
        </button>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
  muted,
}: {
  label: string;
  value: string;
  tone?: 'positive' | 'negative';
  muted?: boolean;
}) {
  const valueColor =
    tone === 'positive'
      ? 'text-chart-3 font-medium'
      : tone === 'negative'
        ? 'text-destructive font-medium'
        : muted
          ? 'text-muted-foreground'
          : 'text-foreground font-medium';
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`tabular-nums ${valueColor}`}>{value}</dd>
    </div>
  );
}
