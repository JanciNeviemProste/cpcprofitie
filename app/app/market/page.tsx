import Link from 'next/link';
import { formatEur, formatNumber } from '@/components/app/kpi-card';
import { getTrendingModels } from '@/lib/db/queries/dashboard';

export const metadata = { title: 'Trh' };
export const dynamic = 'force-dynamic';

export default async function MarketPage() {
  const trending = await getTrendingModels(100);

  return (
    <div className="container mx-auto px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Trh</h1>
        <p className="text-muted-foreground text-sm">
          Modely zoradené podľa likvidity. Klikom otvoríte detailnú analýzu.
        </p>
      </div>

      {trending.length === 0 ? (
        <div className="mt-8 border-border/40 rounded-xl border p-12 text-center">
          <p className="text-muted-foreground text-sm">
            Zatiaľ žiadne modely. Backfill model_id beží — po dokončení sa zoznam naplní.
          </p>
        </div>
      ) : (
        <div className="border-border/40 mt-8 overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-muted-foreground text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Model</th>
                <th className="px-4 py-3 text-right font-medium">Aktívne</th>
                <th className="px-4 py-3 text-right font-medium">Medián</th>
              </tr>
            </thead>
            <tbody>
              {trending.map((t) => (
                <tr key={t.modelSlug} className="border-border/40 hover:bg-muted/20 border-t">
                  <td className="px-4 py-3">
                    <Link
                      href={`/app/analysis/${t.modelSlug}`}
                      className="hover:text-primary font-medium"
                    >
                      {t.modelName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatNumber(t.countActive)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {t.median != null ? formatEur(t.median) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
