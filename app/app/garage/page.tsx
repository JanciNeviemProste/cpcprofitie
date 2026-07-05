import Link from 'next/link';
import { Plus } from 'lucide-react';
import { AddGarageForm } from '@/components/app/garage/add-garage-form';
import { DeleteEntryButton } from '@/components/app/delete-entry-button';
import { formatEur, formatNumber } from '@/components/app/kpi-card';
import { getCurrentUser } from '@/lib/auth/server';
import { canAddGarageEntry } from '@/lib/billing/quota';
import { effectivePlan, getUserSubscription } from '@/lib/billing/subscription';
import { getUsageSummary } from '@/lib/billing/usage';
import { getGarageEntries } from '@/lib/db/queries/dashboard';
import { getModelOptions } from '@/lib/db/queries/models';
import { deleteGarageEntryAction } from './actions';

export const metadata = { title: 'Moja garáž' };
export const dynamic = 'force-dynamic';

export default async function GaragePage() {
  const user = await getCurrentUser();
  // Anonymous visitors only see a login prompt — skip all data fetching.
  const [cars, models, sub, usage] = user
    ? await Promise.all([
        getGarageEntries(user.id),
        getModelOptions(),
        getUserSubscription(user.id),
        getUsageSummary(user.id),
      ])
    : [[], [], null, null];
  const quota = canAddGarageEntry(effectivePlan(sub), usage?.garageCount ?? 0);

  return (
    <div className="container mx-auto px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Moja garáž</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Sledujte cenovú pozíciu vlastných vozidiel voči trhu.
          </p>
        </div>
      </div>

      <div className="mt-6">
        {user ? (
          <AddGarageForm
            models={models}
            atLimit={!quota.ok}
            limitHint={
              !quota.ok
                ? `Dosiahli ste limit ${quota.limit} vozidiel vo vašom pláne.`
                : ''
            }
          />
        ) : (
          <p className="text-muted-foreground text-sm">
            <Link href="/login?next=%2Fapp%2Fgarage" className="text-primary underline underline-offset-2">
              Prihláste sa
            </Link>{' '}
            a pridajte svoje vozidlá.
          </p>
        )}
      </div>

      {cars.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cars.map((car) => (
            <article
              key={car.id}
              className="border-border/40 bg-card/30 rounded-xl border p-5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-muted-foreground text-xs">{car.year ?? '—'}</p>
                  <h2 className="text-base font-semibold tracking-tight">{car.modelName}</h2>
                </div>
                <DeleteEntryButton
                  id={car.id}
                  action={deleteGarageEntryAction}
                  confirmText={`Vymazať vozidlo „${car.modelName}“ z garáže?`}
                  successText="Vozidlo vymazané."
                />
              </div>

              <dl className="mt-4 space-y-2 text-sm">
                <Row
                  label="Najazdené"
                  value={car.mileageKm != null ? `${formatNumber(car.mileageKm)} km` : '—'}
                />
                <Row
                  label="Nákupná cena"
                  value={car.purchasePriceEur != null ? formatEur(car.purchasePriceEur) : '—'}
                />
                <Row
                  label="Cieľová marža"
                  value={car.targetMarginEur != null ? formatEur(car.targetMarginEur) : '—'}
                  muted
                />
              </dl>

              {car.modelSlug && (
                <Link
                  href={`/app/analysis/${car.modelSlug}`}
                  className="text-primary mt-4 inline-block text-xs hover:underline"
                >
                  Pozrieť trhovú analýzu →
                </Link>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-8 border-border/60 hover:border-primary/40 hover:bg-muted/30 group flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-12 text-center">
      <Plus className="text-muted-foreground group-hover:text-primary size-8" />
      <p className="font-medium">Vaša garáž je prázdna</p>
      <p className="text-muted-foreground max-w-md text-sm">
        Pridajte svoje vozidlá a CPCProfit bude sledovať ich cenovú pozíciu voči trhu.
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={`tabular-nums ${muted ? 'text-muted-foreground' : 'text-foreground font-medium'}`}
      >
        {value}
      </dd>
    </div>
  );
}
