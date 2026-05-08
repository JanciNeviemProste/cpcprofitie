import Link from 'next/link';
import { Bell, Plus } from 'lucide-react';
import { formatEur } from '@/components/app/kpi-card';
import { mockWatchlist } from '@/lib/mock';

export const metadata = { title: 'Sledované modely' };

export default function WatchlistPage() {
  const items = mockWatchlist();

  return (
    <div className="container mx-auto px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sledované modely</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            E-mail upozornenie keď sa objaví zhoda s vašimi kritériami.
          </p>
        </div>
        <button className="border-primary/40 bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium">
          <Plus className="size-4" />
          Pridať sledovanie
        </button>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {items.map((w) => (
          <article key={w.id} className="border-border/40 bg-card/30 rounded-xl border p-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold tracking-tight">{w.modelName}</h2>
                <p className="text-muted-foreground mt-1 text-xs">{w.region} kraj</p>
              </div>
              <span className="bg-primary/15 text-primary inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium">
                <Bell className="size-3" />
                Aktívne
              </span>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground text-xs">Max. cena</dt>
                <dd className="font-medium tabular-nums">{formatEur(w.maxPriceEur)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Najstarší rok</dt>
                <dd className="font-medium tabular-nums">{w.minYear}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted-foreground text-xs">Zhody za 7 dní</dt>
                <dd className="text-primary text-xl font-semibold tabular-nums">
                  {w.matchesLast7d}
                </dd>
              </div>
            </dl>

            <Link
              href={`/app/analysis/${w.modelSlug}`}
              className="text-primary mt-4 inline-block text-xs hover:underline"
            >
              Pozrieť analýzu modelu →
            </Link>
          </article>
        ))}

        <button className="border-border/60 hover:border-primary/40 hover:bg-muted/30 group flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-sm transition-colors">
          <Plus className="text-muted-foreground group-hover:text-primary size-6" />
          <span className="text-muted-foreground group-hover:text-foreground font-medium">
            Pridať ďalšie sledovanie
          </span>
        </button>
      </div>
    </div>
  );
}
