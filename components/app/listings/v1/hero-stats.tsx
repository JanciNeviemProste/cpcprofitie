import type { SourceCount } from '@/lib/db/queries/listings';

function fmt(n: number): string {
  return n.toLocaleString('sk-SK').replace(/,/g, ' ');
}

type Props = {
  totalListings: number;
  totalPhotos: number;
  totalEnriched: number;
  bySource: SourceCount[];
  resultCount: number;
};

function MiniBars({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex h-8 items-end gap-1">
      {values.map((v, i) => (
        <span
          key={i}
          className="from-primary/70 to-primary/20 w-1.5 rounded-sm bg-gradient-to-t"
          style={{ height: `${Math.max(8, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

const SOURCE_DOTS = [
  'from-emerald-400 to-emerald-600',
  'from-sky-400 to-sky-600',
  'from-amber-400 to-amber-600',
];

export function HeroStats({
  totalListings,
  totalPhotos,
  totalEnriched,
  bySource,
  resultCount,
}: Props) {
  const enrichedPct = totalListings > 0 ? Math.round((totalEnriched / totalListings) * 100) : 0;
  const photoPct = totalListings > 0 ? Math.round((totalPhotos / totalListings) * 10) / 10 : 0;

  return (
    <section className="relative isolate overflow-hidden rounded-3xl">
      {/* Gradient mesh background */}
      <div
        aria-hidden
        className="from-primary/10 via-background to-background absolute inset-0 -z-10 bg-gradient-to-br"
      />
      <div
        aria-hidden
        className="from-primary/20 absolute top-0 right-0 -z-10 size-[420px] -translate-y-1/3 translate-x-1/3 rounded-full bg-gradient-to-br to-transparent blur-3xl"
      />
      <div
        aria-hidden
        className="from-fuchsia-500/10 absolute bottom-0 left-1/3 -z-10 size-[360px] translate-y-1/3 rounded-full bg-gradient-to-tr to-transparent blur-3xl"
      />

      <div className="border-border/40 bg-background/40 rounded-3xl border p-6 backdrop-blur-md sm:p-8">
        <div className="mb-7 max-w-3xl">
          <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-[0.18em]">
            Trh áut · Live
          </p>
          <h1 className="text-foreground bg-gradient-to-br from-white via-white to-white/70 bg-clip-text text-4xl font-bold tracking-tight sm:text-5xl dark:text-transparent">
            Slovenský trh áut
          </h1>
          <p className="text-muted-foreground mt-3 text-sm tabular-nums sm:text-base">
            {fmt(totalListings)} inzerátov · {fmt(totalPhotos)} fotiek · {bySource.length} zdroje
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: total listings */}
          <div className="group from-primary/40 to-primary/0 relative rounded-2xl bg-gradient-to-br p-px transition-all hover:scale-[1.01]">
            <div className="bg-card/60 shadow-primary/5 flex h-full flex-col gap-3 rounded-[15px] p-4 shadow-2xl backdrop-blur-md">
              <div className="text-muted-foreground flex items-center justify-between text-[11px] font-medium uppercase tracking-wider">
                <span>Aktívne inzeráty</span>
                <span className="bg-emerald-500/10 text-emerald-500 inline-flex h-5 items-center rounded-full px-2 text-[10px] font-semibold">
                  LIVE
                </span>
              </div>
              <div className="text-foreground text-3xl font-bold tabular-nums sm:text-4xl">
                {fmt(totalListings)}
              </div>
              <div className="mt-auto">
                <MiniBars values={[3, 5, 4, 7, 6, 8, 9, 7, 10, 11]} />
              </div>
            </div>
          </div>

          {/* Card 2: filtered result */}
          <div className="group from-sky-500/40 to-sky-500/0 relative rounded-2xl bg-gradient-to-br p-px transition-all hover:scale-[1.01]">
            <div className="bg-card/60 shadow-primary/5 flex h-full flex-col gap-3 rounded-[15px] p-4 shadow-2xl backdrop-blur-md">
              <div className="text-muted-foreground text-[11px] font-medium uppercase tracking-wider">
                Filtrovaný výsledok
              </div>
              <div className="text-foreground text-3xl font-bold tabular-nums sm:text-4xl">
                {fmt(resultCount)}
              </div>
              <div className="text-muted-foreground mt-auto text-xs">
                z {fmt(totalListings)} celkovo
              </div>
              <div className="bg-muted/50 mt-1 h-1 w-full overflow-hidden rounded-full">
                <div
                  className="from-sky-400 to-sky-600 h-full bg-gradient-to-r"
                  style={{
                    width: `${totalListings > 0 ? Math.min(100, (resultCount / totalListings) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Card 3: enrichment */}
          <div className="group from-fuchsia-500/40 to-fuchsia-500/0 relative rounded-2xl bg-gradient-to-br p-px transition-all hover:scale-[1.01]">
            <div className="bg-card/60 shadow-primary/5 flex h-full flex-col gap-3 rounded-[15px] p-4 shadow-2xl backdrop-blur-md">
              <div className="text-muted-foreground text-[11px] font-medium uppercase tracking-wider">
                Enrichment
              </div>
              <div className="text-foreground text-3xl font-bold tabular-nums sm:text-4xl">
                {enrichedPct}%
              </div>
              <div className="text-muted-foreground mt-auto text-xs tabular-nums">
                {fmt(totalEnriched)} detailov
              </div>
              <div className="bg-muted/50 mt-1 h-1 w-full overflow-hidden rounded-full">
                <div
                  className="from-fuchsia-400 to-fuchsia-600 h-full bg-gradient-to-r"
                  style={{ width: `${enrichedPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Card 4: by source */}
          <div className="group from-amber-500/40 to-amber-500/0 relative rounded-2xl bg-gradient-to-br p-px transition-all hover:scale-[1.01]">
            <div className="bg-card/60 shadow-primary/5 flex h-full flex-col gap-3 rounded-[15px] p-4 shadow-2xl backdrop-blur-md">
              <div className="text-muted-foreground flex items-center justify-between text-[11px] font-medium uppercase tracking-wider">
                <span>Fotky / inzerát</span>
              </div>
              <div className="text-foreground text-3xl font-bold tabular-nums sm:text-4xl">
                {photoPct.toFixed(1)}
              </div>
              <div className="text-muted-foreground mt-auto flex flex-col gap-1 text-[11px]">
                {bySource.slice(0, 3).map((s, i) => (
                  <div key={s.source} className="flex items-center gap-2">
                    <span
                      className={`size-2 rounded-full bg-gradient-to-br ${SOURCE_DOTS[i] ?? 'from-muted to-muted'}`}
                    />
                    <span className="flex-1 truncate">{s.source}</span>
                    <span className="text-foreground tabular-nums font-medium">{fmt(s.count)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
