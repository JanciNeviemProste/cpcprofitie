import Link from 'next/link';
import { Bell } from 'lucide-react';
import { DeleteEntryButton } from '@/components/app/delete-entry-button';
import { AddWatchlistForm } from '@/components/app/watchlist/add-watchlist-form';
import { NotifyToggle } from '@/components/app/watchlist/notify-toggle';
import { formatEur } from '@/components/app/kpi-card';
import { getCurrentUser } from '@/lib/auth/server';
import { canCreateWatchlist } from '@/lib/billing/quota';
import { effectivePlan, getUserSubscription } from '@/lib/billing/subscription';
import { getUsageSummary } from '@/lib/billing/usage';
import { getWatchlistEntries } from '@/lib/db/queries/dashboard';
import { getModelOptions } from '@/lib/db/queries/models';
import { deleteWatchlistEntryAction } from './actions';

export const metadata = { title: 'Sledované modely' };
export const dynamic = 'force-dynamic';

export default async function WatchlistPage() {
  const user = await getCurrentUser();
  // Anonymous visitors only see a login prompt — skip all data fetching.
  const [items, models, sub, usage] = user
    ? await Promise.all([
        getWatchlistEntries(user.id),
        getModelOptions(),
        getUserSubscription(user.id),
        getUsageSummary(user.id),
      ])
    : [[], [], null, null];
  const quota = canCreateWatchlist(effectivePlan(sub), usage?.watchlistCount ?? 0);

  return (
    <div className="container mx-auto px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sledované modely</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            E-mail upozornenie keď sa objaví zhoda s vašimi kritériami.
          </p>
        </div>
      </div>

      <div className="mt-6">
        {user ? (
          <AddWatchlistForm
            models={models}
            atLimit={!quota.ok}
            limitHint={
              !quota.ok
                ? `Dosiahli ste limit ${quota.limit} sledovaní vo vašom pláne.`
                : ''
            }
          />
        ) : (
          <p className="text-muted-foreground text-sm">
            <Link
              href="/login?next=%2Fapp%2Fwatchlist"
              className="text-primary underline underline-offset-2"
            >
              Prihláste sa
            </Link>{' '}
            a vytvorte si sledovania.
          </p>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {items.map((w) => (
            <article key={w.id} className="border-border/40 bg-card/30 rounded-xl border p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold tracking-tight">{w.modelName}</h2>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {w.region ? `${w.region} kraj` : 'Všetky regióny'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <NotifyToggle id={w.id} notifyByEmail={w.notifyByEmail} />
                  <DeleteEntryButton
                    id={w.id}
                    action={deleteWatchlistEntryAction}
                    confirmText={`Vymazať sledovanie „${w.modelName}“?`}
                    successText="Sledovanie vymazané."
                  />
                </div>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground text-xs">Max. cena</dt>
                  <dd className="font-medium tabular-nums">
                    {w.maxPriceEur != null ? formatEur(w.maxPriceEur) : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Najstarší rok</dt>
                  <dd className="font-medium tabular-nums">{w.minYear ?? '—'}</dd>
                </div>
              </dl>

              {w.modelSlug && (
                <Link
                  href={`/app/analysis/${w.modelSlug}`}
                  className="text-primary mt-4 inline-block text-xs hover:underline"
                >
                  Pozrieť analýzu modelu →
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
    <div className="mt-8 border-border/60 hover:border-primary/40 hover:bg-muted/30 group flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-12 text-center">
      <Bell className="text-muted-foreground group-hover:text-primary size-8" />
      <p className="font-medium">Žiadne sledovania</p>
      <p className="text-muted-foreground max-w-md text-sm">
        Vytvorte sledovanie modelu a pošleme vám e-mail keď nájdeme zhodu.
      </p>
    </div>
  );
}
