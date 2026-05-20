import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq, and } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { vehicleMakes, vehicleModels } from '@/lib/db/schema';
import { getModelTrajectory } from '@/lib/db/queries/trends';

export const dynamic = 'force-dynamic';

const NBSP = ' ';

function fmtPrice(eur: number | null): string {
  if (eur == null) return '—';
  return `${eur.toLocaleString('sk-SK')}${NBSP}€`;
}

/** URL slug "skoda-octavia" → { makeSlug: "skoda", modelSlug: "octavia" }. */
function parseSlug(combined: string): { makeSlug: string; modelSlug: string } | null {
  const idx = combined.indexOf('-');
  if (idx < 1) return null;
  return {
    makeSlug: combined.slice(0, idx),
    modelSlug: combined.slice(idx + 1),
  };
}

async function resolveModelId(makeSlug: string, modelSlug: string): Promise<{
  id: number;
  name: string;
} | null> {
  const db = getDb();
  const rows = await db
    .select({ id: vehicleModels.id, name: vehicleModels.name })
    .from(vehicleModels)
    .innerJoin(vehicleMakes, eq(vehicleMakes.id, vehicleModels.makeId))
    .where(and(eq(vehicleMakes.slug, makeSlug), eq(vehicleModels.slug, modelSlug)))
    .limit(1);
  return rows[0] ?? null;
}

export default async function TrendDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const parsed = parseSlug(slug);
  if (!parsed) notFound();
  const model = await resolveModelId(parsed.makeSlug, parsed.modelSlug);
  if (!model) notFound();

  const trajectory = await getModelTrajectory(model.id, { weeks: 12 });

  const max = Math.max(...trajectory.map((t) => t.medianPriceEur ?? 0), 0);
  const min = Math.min(
    ...trajectory.map((t) => t.medianPriceEur ?? Number.POSITIVE_INFINITY),
  );

  return (
    <div className="container mx-auto px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-4">
        <Link
          href="/app/trends"
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ← Späť na trendy
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{model.name}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Týždenná trajektória posledných 12 týždňov.
        </p>
      </div>

      {trajectory.length === 0 ? (
        <div className="border-border/60 rounded-lg border p-10 text-center">
          <p className="text-muted-foreground text-sm">
            Žiadne snapshoty zatiaľ. Weekly cron ich začne generovať po nedeli 02:00.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="border-border/60 rounded-lg border p-6">
            <h2 className="mb-4 text-sm font-semibold">Medián ceny (€)</h2>
            <div className="flex h-48 items-end gap-2">
              {trajectory.map((t) => {
                const height = t.medianPriceEur && max
                  ? Math.max(8, ((t.medianPriceEur - min * 0.95) / (max - min * 0.95)) * 100)
                  : 0;
                return (
                  <div key={t.capturedOn.toISOString()} className="flex flex-1 flex-col items-center gap-1">
                    <div className="text-muted-foreground text-[10px] tabular-nums">
                      {t.medianPriceEur != null ? Math.round(t.medianPriceEur / 100) / 10 + 'k' : '—'}
                    </div>
                    <div
                      className="bg-primary/60 hover:bg-primary w-full rounded-sm transition-colors"
                      style={{ height: `${height}%` }}
                      title={`${t.capturedOn.toISOString().slice(0, 10)}: ${fmtPrice(t.medianPriceEur)}`}
                    />
                    <div className="text-muted-foreground text-[10px]">
                      {t.capturedOn.toISOString().slice(5, 10)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-border/60 overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-border/40 border-b text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Týždeň</th>
                  <th className="px-4 py-3 text-right font-medium">Aktívne inzeráty</th>
                  <th className="px-4 py-3 text-right font-medium">Medián cena</th>
                </tr>
              </thead>
              <tbody>
                {trajectory.map((t) => (
                  <tr
                    key={t.capturedOn.toISOString()}
                    className="border-border/30 hover:bg-muted/20 border-b transition-colors last:border-b-0"
                  >
                    <td className="px-4 py-3">{t.capturedOn.toISOString().slice(0, 10)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {t.countActive.toLocaleString('sk-SK')}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {fmtPrice(t.medianPriceEur)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
