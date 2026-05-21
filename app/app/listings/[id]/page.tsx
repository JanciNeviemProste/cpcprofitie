import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PhotoGallery } from '@/components/app/listings/photo-gallery';
import { getListingById, type ListingDetailFull } from '@/lib/db/queries/listings';

export const dynamic = 'force-dynamic';

const NBSP = ' ';

function formatPrice(eur: number | null): string {
  if (eur == null) return '—';
  return `${Math.round(eur).toLocaleString('sk-SK')}${NBSP}€`;
}

function formatKm(km: number | null): string {
  if (km == null) return '—';
  return `${km.toLocaleString('sk-SK')}${NBSP}km`;
}

function formatFuel(fuel: string | null): string {
  if (!fuel) return '—';
  const map: Record<string, string> = {
    gasoline: 'Benzín',
    diesel: 'Diesel',
    hybrid: 'Hybrid',
    phev: 'PHEV',
    electric: 'Elektro',
    lpg: 'LPG',
    cng: 'CNG',
    other: 'Iné',
  };
  return map[fuel] ?? fuel;
}

function title(d: ListingDetailFull): string {
  if (d.rawTitle) return d.rawTitle;
  if (d.makeName && d.modelName) return `${d.makeName} ${d.modelName}`;
  if (d.makeName) return d.makeName;
  return `Inzerát #${d.sourceId}`;
}

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idStr } = await params;
  let id: bigint;
  try {
    id = BigInt(idStr);
  } catch {
    notFound();
  }
  const detail = await getListingById(id);
  if (!detail) notFound();

  return (
    <div className="container mx-auto px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-4">
        <Link
          href="/app/listings"
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ← Späť na zoznam
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PhotoGallery photos={detail.photos} />
        </div>

        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{title(detail)}</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {detail.year ?? '—'} · {formatKm(detail.mileageKm)} · {formatFuel(detail.fuel)}
            </p>
          </div>

          <div className="border-border/60 rounded-lg border p-4">
            <div className="text-3xl font-bold tracking-tight">
              {formatPrice(detail.priceEur)}
            </div>
            <div className="text-muted-foreground mt-1 text-xs">
              Zobrazené {detail.firstSeenAt.toLocaleDateString('sk-SK')} · zdroj{' '}
              <span className="font-medium">{detail.source}</span>
            </div>
          </div>

          <a
            href={detail.url}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-primary text-primary-foreground hover:bg-primary/90 block rounded-md px-4 py-2 text-center text-sm font-medium"
          >
            Otvoriť originálny inzerát ↗
          </a>

          <dl className="border-border/60 grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border p-4 text-sm">
            <dt className="text-muted-foreground">Región</dt>
            <dd>{detail.region ?? '—'}</dd>
            {detail.bodyType && (
              <>
                <dt className="text-muted-foreground">Karoséria</dt>
                <dd>{detail.bodyType}</dd>
              </>
            )}
            {detail.colorExterior && (
              <>
                <dt className="text-muted-foreground">Farba</dt>
                <dd>{detail.colorExterior}</dd>
              </>
            )}
            {detail.powerKw != null && (
              <>
                <dt className="text-muted-foreground">Výkon</dt>
                <dd>{detail.powerKw}{NBSP}kW</dd>
              </>
            )}
            {detail.engineCcm != null && (
              <>
                <dt className="text-muted-foreground">Objem</dt>
                <dd>{detail.engineCcm.toLocaleString('sk-SK')}{NBSP}cm³</dd>
              </>
            )}
            {detail.vin && (
              <>
                <dt className="text-muted-foreground">VIN</dt>
                <dd className="font-mono text-xs">{detail.vin}</dd>
              </>
            )}
            {detail.sellerName && (
              <>
                <dt className="text-muted-foreground">Predajca</dt>
                <dd>
                  {detail.sellerName}
                  {detail.sellerType === 'dealer' ? ' (autobazár)' : ''}
                </dd>
              </>
            )}
          </dl>
        </div>
      </div>

      {detail.description && (
        <section className="mt-8">
          <h2 className="mb-2 text-lg font-semibold">Popis</h2>
          <p className="text-muted-foreground whitespace-pre-line text-sm">
            {detail.description}
          </p>
        </section>
      )}

      {detail.equipment.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-lg font-semibold">Výbava</h2>
          <ul className="flex flex-wrap gap-2 text-xs">
            {detail.equipment.map((item) => (
              <li
                key={item}
                className="border-border/60 text-muted-foreground rounded-full border px-3 py-1"
              >
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
