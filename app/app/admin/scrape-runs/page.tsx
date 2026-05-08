import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { formatNumber } from '@/components/app/kpi-card';

export const metadata = { title: 'Admin · Scrape behy' };

type Status = 'succeeded' | 'failed' | 'running';

type Run = {
  id: number;
  source: string;
  status: Status;
  startedAt: Date;
  durationMs: number;
  listingsAdded: number;
  listingsUpdated: number;
  errorMessage?: string;
};

function mockRuns(): Run[] {
  const sources = ['autobazar.sk', 'mobile.de', 'autoscout24'];
  const now = Date.now();
  return Array.from({ length: 18 }, (_, i) => {
    const status: Status =
      i === 0 ? 'running' : i === 5 ? 'failed' : 'succeeded';
    return {
      id: 1000 - i,
      source: sources[i % sources.length]!,
      status,
      startedAt: new Date(now - i * 6 * 60 * 60 * 1000),
      durationMs: status === 'running' ? 0 : 90_000 + ((i * 7919) % 280_000),
      listingsAdded: status === 'failed' ? 0 : 80 + ((i * 31) % 320),
      listingsUpdated: status === 'failed' ? 0 : 1200 + ((i * 53) % 800),
      errorMessage:
        status === 'failed'
          ? 'HTTP 429 from upstream — backoff scheduled for next window'
          : undefined,
    };
  });
}

export default function ScrapeRunsAdminPage() {
  const runs = mockRuns();
  const succeeded = runs.filter((r) => r.status === 'succeeded').length;
  const failed = runs.filter((r) => r.status === 'failed').length;
  const totalAdded = runs.reduce((s, r) => s + r.listingsAdded, 0);

  return (
    <div className="container mx-auto px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-1">
        <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
          Admin
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Scrape behy</h1>
        <p className="text-muted-foreground text-sm">
          Posledných 18 behov per zdroj. Demo dáta pred prvým produkčným cron behom.
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Úspešných (24h)" value={String(succeeded)} tone="positive" />
        <Stat label="Zlyhaných (24h)" value={String(failed)} tone={failed > 0 ? 'negative' : 'neutral'} />
        <Stat label="Pridaných listingov" value={formatNumber(totalAdded)} />
      </div>

      <div className="border-border/40 mt-10 overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-muted-foreground text-xs uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left font-medium">ID</th>
              <th className="px-4 py-3 text-left font-medium">Zdroj</th>
              <th className="px-4 py-3 text-left font-medium">Stav</th>
              <th className="px-4 py-3 text-left font-medium">Začiatok</th>
              <th className="px-4 py-3 text-right font-medium">Trvanie</th>
              <th className="px-4 py-3 text-right font-medium">+ Listingy</th>
              <th className="px-4 py-3 text-right font-medium">↻ Aktualizácie</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id} className="border-border/40 border-t">
                <td className="text-muted-foreground px-4 py-3 font-mono text-xs">#{r.id}</td>
                <td className="px-4 py-3 font-medium">{r.source}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={r.status} />
                  {r.errorMessage && (
                    <p className="text-destructive mt-1 text-xs">{r.errorMessage}</p>
                  )}
                </td>
                <td className="text-muted-foreground px-4 py-3 text-xs">
                  {r.startedAt.toLocaleString('sk-SK', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {r.status === 'running' ? '—' : `${(r.durationMs / 1000).toFixed(1)} s`}
                </td>
                <td className="text-chart-3 px-4 py-3 text-right font-medium tabular-nums">
                  {r.listingsAdded > 0 ? `+${formatNumber(r.listingsAdded)}` : '—'}
                </td>
                <td className="text-muted-foreground px-4 py-3 text-right tabular-nums">
                  {r.listingsUpdated > 0 ? formatNumber(r.listingsUpdated) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  if (status === 'succeeded') {
    return (
      <span className="bg-chart-3/15 text-chart-3 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium">
        <CheckCircle2 className="size-3" />
        OK
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="bg-destructive/15 text-destructive inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium">
        <XCircle className="size-3" />
        Zlyhal
      </span>
    );
  }
  return (
    <span className="bg-primary/15 text-primary inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium">
      <Clock className="size-3 animate-pulse" />
      Beží
    </span>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'positive' | 'negative' | 'neutral';
}) {
  const valueClass =
    tone === 'positive'
      ? 'text-chart-3'
      : tone === 'negative'
        ? 'text-destructive'
        : 'text-foreground';
  return (
    <div className="border-border/40 bg-card/40 rounded-xl border p-5">
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${valueClass}`}>{value}</p>
    </div>
  );
}
