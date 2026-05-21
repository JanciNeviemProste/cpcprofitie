import { notFound } from 'next/navigation';
import { KpiCard, formatEur, formatNumber } from '@/components/app/kpi-card';
import { getModelKpi } from '@/lib/db/queries/dashboard';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: `Analýza ${slug}` };
}

export default async function AnalysisPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const kpi = await getModelKpi(slug);
  if (!kpi) notFound();

  return (
    <div className="container mx-auto px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">{kpi.modelName}</h1>
        <p className="text-muted-foreground text-sm">
          Aktuálne KPI z {formatNumber(kpi.countActive)} aktívnych inzerátov.
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Medián ceny"
          value={kpi.median != null ? formatEur(kpi.median) : '—'}
        />
        <KpiCard
          label="P25 / P75"
          value={
            kpi.p25 != null && kpi.p75 != null
              ? `${formatEur(kpi.p25)} – ${formatEur(kpi.p75)}`
              : '—'
          }
          hint="50% inzerátov v tomto pásme"
        />
        <KpiCard
          label="Aktívne inzeráty"
          value={formatNumber(kpi.countActive)}
        />
        <KpiCard
          label="Priemerný rok / km"
          value={
            kpi.avgYear != null && kpi.avgMileageKm != null
              ? `${kpi.avgYear} • ${formatNumber(kpi.avgMileageKm)}`
              : '—'
          }
        />
      </div>

      <section className="border-border/40 bg-card/30 mt-10 rounded-xl border p-6">
        <h2 className="text-base font-semibold tracking-tight">Historické trendy</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Časový rad cien (medián, p25/p75), histogram distribúcie a doba predaja sa generujú
          weekly-maintenance cronom. Po prvom úspešnom behu (nedeľa 02:00 UTC) sa tu objavia grafy.
        </p>
      </section>
    </div>
  );
}
