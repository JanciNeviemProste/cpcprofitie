// Detail-page parser for autobazar.eu. The Next.js SSR embeds the full
// `record.findById` tRPC query result into `__NEXT_DATA__`, so we don't have
// to scrape rendered DOM at all — we just JSON-parse the script tag.

import { parseFuel, parseTransmission, prefixRegion } from '../normalize';
import type { NormalizedDetail, NormalizedListing, SellerType } from '../types';

const NEXT_DATA_RE = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/;

type RawImage = {
  previewUrls?: {
    detail_mobile_slider?: string;
    detail_preview?: string;
    detail_thumbnail?: string;
    orig?: string;
    record_premium?: string;
  };
};

type RawRecord = {
  id?: string;
  vin?: string | null;
  description?: string | null;
  otherEquipment?: string | null;
  bodyworkValue?: string | null;
  colorValue?: string | null;
  color?: number | null;
  enginePower?: number | null;
  engineCapacity?: number | null;
  images?: RawImage[];
  user?: {
    displayName?: string | null;
    idFirm?: number | null;
  } | null;
  // Fields for listing override write-back.
  year?: number | null;
  yearValue?: string | null;
  mileage?: number | null;
  finalPrice?: number | null;
  price?: number | null;
  fuelValue?: string | null;
  gearboxValue?: string | null;
  location?: { name?: string | null } | null;
};

function pickRecord(parsed: unknown): RawRecord | null {
  const queries = (parsed as any)?.props?.pageProps?.trpcState?.queries;
  if (!Array.isArray(queries)) return null;
  for (const q of queries) {
    const key = q?.queryKey?.[0];
    if (
      Array.isArray(key) &&
      key[0] === 'record' &&
      key[1] === 'findById' &&
      q?.state?.data
    ) {
      return q.state.data as RawRecord;
    }
  }
  return null;
}

function pickPhotoUrl(img: RawImage): string | null {
  const urls = img?.previewUrls ?? {};
  // Prefer the slider variant (decent resolution, ~800px), falling back to
  // preview, then thumbnail. orig is often blank for performance reasons.
  return (
    urls.detail_mobile_slider ||
    urls.record_premium ||
    urls.detail_preview ||
    urls.orig ||
    urls.detail_thumbnail ||
    null
  );
}

const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;

export function detailUrl(listing: NormalizedListing): string {
  // Listing URL is already canonical `/detail/x/<id>/` which permanently
  // redirects to `/detail/<slug>/<id>/`; the scrape follows redirects so we
  // re-use it as-is.
  return listing.url;
}

export function parseDetailPage(
  html: string,
  listing: NormalizedListing,
): NormalizedDetail {
  const m = NEXT_DATA_RE.exec(html);
  const fallback: NormalizedDetail = {
    source: 'autobazar.eu',
    sourceId: listing.sourceId,
    photos: [],
    bodyType: null,
    colorExterior: null,
    colorInterior: null,
    powerKw: null,
    engineCcm: null,
    vin: null,
    sellerType: null,
    sellerName: null,
    description: null,
    equipment: [],
  };
  if (!m) return fallback;

  let parsed: unknown;
  try {
    parsed = JSON.parse(m[1]!);
  } catch {
    return fallback;
  }
  const record = pickRecord(parsed);
  if (!record) return fallback;

  const photos: string[] = [];
  const seen = new Set<string>();
  for (const img of record.images ?? []) {
    const url = pickPhotoUrl(img);
    if (!url) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    photos.push(url);
  }

  const vin =
    typeof record.vin === 'string' && VIN_RE.test(record.vin.toUpperCase())
      ? record.vin.toUpperCase()
      : null;

  const sellerName = record.user?.displayName?.trim() || null;
  // `idFirm` is non-null for dealers and null/undefined for private sellers.
  const sellerType: SellerType | null = record.user
    ? record.user.idFirm
      ? 'dealer'
      : 'private'
    : null;

  // Equipment fields: `otherEquipment` is a free-text comma list. Split on
  // commas, trim, drop empties.
  const equipmentSrc = record.otherEquipment ?? '';
  const equipment =
    typeof equipmentSrc === 'string' && equipmentSrc.trim().length > 0
      ? equipmentSrc
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

  // Listing field overrides from the rich Next.js record. Always patches NULL
  // columns only (handled in persistDetails), so safe to fill liberally.
  const year =
    typeof record.year === 'number' && Number.isFinite(record.year)
      ? Math.round(record.year)
      : typeof record.yearValue === 'string'
        ? Number(record.yearValue.match(/\d{4}/)?.[0])
        : null;
  const mileageKm =
    typeof record.mileage === 'number' && Number.isFinite(record.mileage)
      ? Math.round(record.mileage)
      : null;
  const priceEur =
    typeof record.finalPrice === 'number' && Number.isFinite(record.finalPrice)
      ? Math.round(record.finalPrice)
      : typeof record.price === 'number' && Number.isFinite(record.price)
        ? Math.round(record.price)
        : null;
  const fuel = parseFuel(record.fuelValue ?? null);
  const transmission = parseTransmission(record.gearboxValue ?? null);
  const region = prefixRegion(record.location?.name ?? null, 'SK');

  const listingOverrides: NormalizedDetail['listingOverrides'] = {};
  if (year != null && year >= 1980 && year <= new Date().getFullYear() + 1)
    listingOverrides.year = year;
  if (mileageKm != null && mileageKm > 0) listingOverrides.mileageKm = mileageKm;
  if (priceEur != null && priceEur >= 100) listingOverrides.priceEur = priceEur;
  if (fuel != null) listingOverrides.fuel = fuel;
  if (transmission != null) listingOverrides.transmission = transmission;
  if (region != null) listingOverrides.region = region;

  return {
    source: 'autobazar.eu',
    sourceId: listing.sourceId,
    photos,
    bodyType: record.bodyworkValue?.trim() || null,
    colorExterior: record.colorValue?.trim() || null,
    colorInterior: null,
    powerKw:
      typeof record.enginePower === 'number' && Number.isFinite(record.enginePower)
        ? Math.round(record.enginePower)
        : null,
    engineCcm:
      typeof record.engineCapacity === 'number' &&
      Number.isFinite(record.engineCapacity)
        ? Math.round(record.engineCapacity)
        : null,
    vin,
    sellerType,
    sellerName,
    description: record.description?.trim() || null,
    equipment,
    listingOverrides: Object.keys(listingOverrides).length > 0 ? listingOverrides : undefined,
  };
}
