import { parseFuel, parseTransmission, prefixRegion, slugify } from '../normalize';
import type { NormalizedListing } from '../types';
import { detailUrl, parseDetailPage } from './autobazar-eu-detail';
import type { ScraperSource } from './source-interface';

const BASE = 'https://www.autobazar.eu';

// autobazar.eu is a Next.js SPA whose listing data is server-rendered into a
// `__NEXT_DATA__` <script> tag in every page. The tRPC search API
// (/api/trpc/search.search) ignores page/offset/limit parameters (anti-scrape),
// so to walk the catalog we have to fan out over (brand, model) buckets — each
// SEF URL `/vysledky/osobne-vozidla/<brand>/<model>/` returns a unique top-20
// slice of that bucket. BRAND_MODEL_BUCKETS is generated from a one-off probe
// of all 35 top brands' aggregations; see scripts/gen-autobazar-eu-buckets.ts.

// Type: parseListingsPage takes the full HTML and pulls listings out of
// __NEXT_DATA__. It does not use cheerio because the listing cards on the
// rendered DOM are produced client-side and the server HTML's <a> anchors
// only cover the homepage carousel.

const NEXT_DATA_RE = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/;

type RawListing = {
  id?: string;
  title?: string | null;
  brandValue?: string | null;
  carModelValue?: string | null;
  price?: number | null;
  finalPrice?: number | null;
  listPrice?: number | null;
  year?: number | null;
  yearValue?: number | string | null;
  yearOfProduction?: number | null;
  mileage?: number | null;
  fuelValue?: string | null;
  gearboxValue?: string | null;
  location?: { name?: string | null } | null;
  bodyworkValue?: string | null;
  vin?: string | null;
};

function pickListings(parsed: unknown): RawListing[] {
  // Drill into trpcState.queries[].state.data.data — that's where the
  // `search.search` query result is. We accept any query whose data
  // payload is an array of objects with an `id` field.
  const queries = (parsed as any)?.props?.pageProps?.trpcState?.queries;
  if (!Array.isArray(queries)) return [];
  for (const q of queries) {
    const arr = q?.state?.data?.data;
    if (Array.isArray(arr) && arr.length > 0 && typeof arr[0]?.id === 'string') {
      return arr as RawListing[];
    }
  }
  return [];
}

export function parseListingsPage(html: string): NormalizedListing[] {
  const m = NEXT_DATA_RE.exec(html);
  if (!m) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(m[1]!);
  } catch {
    return [];
  }
  const rows = pickListings(parsed);
  const seen = new Set<string>();
  const results: NormalizedListing[] = [];

  for (const r of rows) {
    const sourceId = (r.id ?? '').toString();
    if (!sourceId || seen.has(sourceId)) continue;
    seen.add(sourceId);

    const title = r.title ?? null;
    const brand = r.brandValue ?? null;
    const model = r.carModelValue ?? null;
    // /detail/x/<id>/ permanently redirects to the canonical /detail/<slug>/<id>/
    // URL, so we don't need to reconstruct the slug client-side.
    const url = `${BASE}/detail/x/${sourceId}/`;

    const price = r.finalPrice ?? r.price ?? r.listPrice ?? null;
    const yearRaw = r.year ?? r.yearOfProduction ?? r.yearValue ?? null;
    const year =
      typeof yearRaw === 'number'
        ? yearRaw
        : typeof yearRaw === 'string'
          ? Number.parseInt(yearRaw, 10)
          : null;
    const mileage = r.mileage ?? null;
    const fuel = parseFuel(r.fuelValue ?? null);
    const transmission = parseTransmission(r.gearboxValue ?? null);
    const regionRaw = r.location?.name ?? null;
    const region = prefixRegion(regionRaw, 'SK');

    results.push({
      source: 'autobazar.eu',
      sourceId,
      url,
      makeSlug: brand ? slugify(brand) : null,
      modelSlug: model ? slugify(model) : null,
      priceEur: typeof price === 'number' && Number.isFinite(price) ? price : null,
      year: typeof year === 'number' && Number.isFinite(year) ? year : null,
      mileageKm: typeof mileage === 'number' && Number.isFinite(mileage) ? mileage : null,
      fuel,
      transmission,
      region,
      rawTitle: title,
      rawPayload: { capturedAt: new Date().toISOString() },
    });
  }

  return results;
}

// Top brand/model buckets generated from autobazar.eu's getAggregations probe.
// Ordered roughly by listing count (most-listed first) so the scraper hits the
// largest pools earliest within a fixed pages-per-run budget.
export const BRAND_MODEL_BUCKETS: ReadonlyArray<{ brand: string; model: string }> = [
  { brand: 'skoda', model: 'octavia-combi' },
  { brand: 'skoda', model: 'octavia' },
  { brand: 'skoda', model: 'superb-combi' },
  { brand: 'skoda', model: 'kodiaq' },
  { brand: 'volkswagen', model: 'passat-variant' },
  { brand: 'kia', model: 'sportage' },
  { brand: 'skoda', model: 'fabia' },
  { brand: 'volkswagen', model: 'tiguan' },
  { brand: 'skoda', model: 'karoq' },
  { brand: 'volkswagen', model: 'golf-variant' },
  { brand: 'skoda', model: 'superb' },
  { brand: 'hyundai', model: 'tucson' },
  { brand: 'skoda', model: 'fabia-combi' },
  { brand: 'volkswagen', model: 'golf' },
  { brand: 'skoda', model: 'scala' },
  { brand: 'bmw', model: 'x5' },
  { brand: 'hyundai', model: 'i30' },
  { brand: 'volvo', model: 'xc60' },
  { brand: 'volkswagen', model: 'touran' },
  { brand: 'volkswagen', model: 'touareg' },
  { brand: 'skoda', model: 'kamiq' },
  { brand: 'ford', model: 'kuga' },
  { brand: 'mercedes-benz', model: 'glc-suv' },
  { brand: 'volvo', model: 'xc90' },
  { brand: 'peugeot', model: '3008' },
  { brand: 'audi', model: 'a6-avant' },
  { brand: 'bmw', model: 'x3' },
  { brand: 'kia', model: 'cee-d-sw' },
  { brand: 'bmw', model: 'rad-5' },
  { brand: 'mercedes-benz', model: 'gle-suv' },
  { brand: 'dacia', model: 'duster' },
  { brand: 'nissan', model: 'qashqai' },
  { brand: 'peugeot', model: '2008' },
  { brand: 'audi', model: 'a4-avant' },
  { brand: 'mercedes-benz', model: 'a-trieda' },
  { brand: 'bmw', model: 'rad-5-touring' },
  { brand: 'citroen', model: 'c3' },
  { brand: 'bmw', model: 'x1' },
  { brand: 'audi', model: 'q7' },
  { brand: 'peugeot', model: '308-break-sw' },
  { brand: 'hyundai', model: 'i30-cw' },
  { brand: 'bmw', model: 'rad-3-touring' },
  { brand: 'peugeot', model: '208' },
  { brand: 'audi', model: 'q5' },
  { brand: 'volvo', model: 'xc40' },
  { brand: 'skoda', model: 'rapid' },
  { brand: 'toyota', model: 'rav4' },
  { brand: 'ford', model: 'focus-kombi' },
  { brand: 'seat', model: 'leon' },
  { brand: 'bmw', model: 'rad-3' },
  { brand: 'land-rover', model: 'range-rover-sport' },
  { brand: 'mercedes-benz', model: 'gla' },
  { brand: 'hyundai', model: 'i20' },
  { brand: 'bmw', model: 'x6' },
  { brand: 'ford', model: 'ranger' },
  { brand: 'peugeot', model: '5008' },
  { brand: 'volkswagen', model: 'sharan' },
  { brand: 'opel', model: 'astra-sport-tourer' },
  { brand: 'volkswagen', model: 'polo' },
  { brand: 'bmw', model: 'rad-7' },
  { brand: 'ford', model: 'mondeo-combi' },
  { brand: 'ford', model: 'focus' },
  { brand: 'land-rover', model: 'defender' },
  { brand: 'bmw', model: 'rad-1' },
  { brand: 'cupra', model: 'formentor' },
  { brand: 'mg', model: 'zs' },
  { brand: 'volkswagen', model: 'passat' },
  { brand: 'volkswagen', model: 'tiguan-allspace' },
  { brand: 'toyota', model: 'yaris' },
  { brand: 'skoda', model: 'yeti' },
  { brand: 'mercedes-benz', model: 'e-trieda-sedan' },
  { brand: 'kia', model: 'cee-d' },
  { brand: 'dacia', model: 'sandero' },
  { brand: 'mercedes-benz', model: 'c-trieda-kombi' },
  { brand: 'opel', model: 'corsa' },
  { brand: 'opel', model: 'astra' },
  { brand: 'citroen', model: 'c4' },
  { brand: 'mercedes-benz', model: 'e-trieda-kombi' },
  { brand: 'mercedes-benz', model: 'c-trieda-sedan' },
  { brand: 'mercedes-benz', model: 'v-trieda' },
  { brand: 'volvo', model: 'v60' },
  { brand: 'land-rover', model: 'discovery' },
  { brand: 'ford', model: 's-max' },
  { brand: 'peugeot', model: '308' },
  { brand: 'audi', model: 'a6' },
  { brand: 'ford', model: 'tourneo-custom' },
  { brand: 'tesla', model: 'model-3' },
  { brand: 'volkswagen', model: 'arteon' },
  { brand: 'mercedes-benz', model: 's-trieda-sedan' },
  { brand: 'citroen', model: 'berlingo' },
  { brand: 'mercedes-benz', model: 'glb' },
  { brand: 'kia', model: 'sorento' },
  { brand: 'suzuki', model: 'vitara' },
  { brand: 'renault', model: 'clio' },
  { brand: 'mercedes-benz', model: 'gls' },
  { brand: 'ford', model: 'transit' },
  { brand: 'audi', model: 'q3' },
  { brand: 'honda', model: 'cr-v' },
  { brand: 'mercedes-benz', model: 'cla-kupe' },
  { brand: 'opel', model: 'insignia' },
  { brand: 'mazda', model: 'cx-5' },
  { brand: 'ford', model: 'fiesta' },
  { brand: 'opel', model: 'mokka' },
  { brand: 'hyundai', model: 'santa-fe' },
  { brand: 'toyota', model: 'corolla' },
  { brand: 'mazda', model: '3' },
  { brand: 'seat', model: 'ateca' },
  { brand: 'mg', model: 'hs' },
  { brand: 'porsche', model: 'cayenne' },
  { brand: 'hyundai', model: 'kona' },
  { brand: 'renault', model: 'captur' },
  { brand: 'subaru', model: 'outback' },
  { brand: 'audi', model: 'e-tron' },
  { brand: 'mercedes-benz', model: 'gle-kupe' },
  { brand: 'land-rover', model: 'range-rover-evoque' },
  { brand: 'ford', model: 'transit-custom' },
  { brand: 'toyota', model: 'c-hr' },
  { brand: 'land-rover', model: 'range-rover' },
  { brand: 'seat', model: 'alhambra' },
  { brand: 'kia', model: 'xceed' },
  { brand: 'mercedes-benz', model: 'b-trieda' },
  { brand: 'kia', model: 'stonic' },
  { brand: 'bmw', model: 'x7' },
  { brand: 'volkswagen', model: 't-roc' },
  { brand: 'land-rover', model: 'range-rover-velar' },
  { brand: 'jeep', model: 'compass' },
  { brand: 'audi', model: 'a6-allroad' },
  { brand: 'peugeot', model: 'rifter' },
  { brand: 'skoda', model: 'rapid-spaceback' },
  { brand: 'volkswagen', model: 't-cross' },
  { brand: 'renault', model: 'megane' },
  { brand: 'jeep', model: 'grand-cherokee' },
  { brand: 'mitsubishi', model: 'asx' },
  { brand: 'ssangyong', model: 'korando' },
  { brand: 'volvo', model: 'v90' },
  { brand: 'seat', model: 'tarraco' },
  { brand: 'dacia', model: 'jogger' },
  { brand: 'mitsubishi', model: 'outlander' },
  { brand: 'skoda', model: 'roomster' },
  { brand: 'nissan', model: 'x-trail' },
  { brand: 'citroen', model: 'c5-aircross' },
  { brand: 'tesla', model: 'model-y' },
  { brand: 'land-rover', model: 'discovery-sport' },
  { brand: 'dacia', model: 'bigster' },
  { brand: 'volkswagen', model: 'id4' },
  { brand: 'citroen', model: 'c3-aircross' },
  { brand: 'kia', model: 'ceed' },
  { brand: 'audi', model: 'a3-sportback' },
  { brand: 'audi', model: 'q8' },
  { brand: 'ford', model: 'c-max' },
  { brand: 'fiat', model: '500' },
  { brand: 'bmw', model: 'x4' },
  { brand: 'kia', model: 'rio' },
  { brand: 'opel', model: 'zafira' },
  { brand: 'volkswagen', model: 'caddy' },
  { brand: 'audi', model: 'a8' },
  { brand: 'renault', model: 'megane-grandtour' },
  { brand: 'jeep', model: 'wrangler' },
  { brand: 'jaguar', model: 'f-pace' },
  { brand: 'ford', model: 'mondeo' },
  { brand: 'kia', model: 'pro-cee-d' },
  { brand: 'fiat', model: 'ducato' },
  { brand: 'renault', model: 'trafic' },
  { brand: 'suzuki', model: 'sx4-s-cross' },
  { brand: 'opel', model: 'crossland' },
  { brand: 'suzuki', model: 'swift' },
  { brand: 'toyota', model: 'corolla-combi' },
  { brand: 'seat', model: 'ibiza' },
  { brand: 'toyota', model: 'proace' },
  { brand: 'opel', model: 'insignia-st' },
  { brand: 'bmw', model: 'rad-4-gran-coupe' },
  { brand: 'citroen', model: 'c4-picasso' },
  { brand: 'mg', model: 'mg3' },
  { brand: 'audi', model: 'a4' },
  { brand: 'audi', model: 'a5-sportback' },
  { brand: 'hyundai', model: 'ix35' },
  { brand: 'ford', model: 'galaxy' },
  { brand: 'ford', model: 'puma' },
  { brand: 'subaru', model: 'forester' },
  { brand: 'skoda', model: 'enyaq' },
  { brand: 'mazda', model: '6-combi-wagon' },
  { brand: 'lexus', model: 'rx' },
  { brand: 'fiat', model: 'panda' },
  { brand: 'mini', model: 'cooper' },
  { brand: 'nissan', model: 'juke' },
  { brand: 'suzuki', model: 'sx4' },
  { brand: 'mini', model: 'countryman' },
  { brand: 'renault', model: 'arkana' },
  { brand: 'mazda', model: 'cx-60' },
  { brand: 'seat', model: 'arona' },
  { brand: 'ford', model: 'mustang' },
  { brand: 'opel', model: 'grandland' },
  { brand: 'audi', model: 'a5' },
  { brand: 'renault', model: 'scenic' },
  { brand: 'alfa-romeo', model: 'stelvio' },
  { brand: 'audi', model: 'a3' },
  { brand: 'toyota', model: 'land-cruiser' },
  { brand: 'kia', model: 'k4' },
  { brand: 'peugeot', model: '508-sw' },
  { brand: 'toyota', model: 'proace-verso' },
  { brand: 'hyundai', model: 'bayon' },
  { brand: 'opel', model: 'frontera' },
  { brand: 'renault', model: 'kangoo' },
];

export const autobazarEu: ScraperSource = {
  id: 'autobazar.eu',
  baseUrl: BASE,
  pageUrl({ page }) {
    const idx = (Math.max(1, page) - 1) % BRAND_MODEL_BUCKETS.length;
    const bucket = BRAND_MODEL_BUCKETS[idx]!;
    return `${BASE}/vysledky/osobne-vozidla/${bucket.brand}/${bucket.model}/`;
  },
  parseListingsPage,
  detailUrl,
  parseDetailPage,
};
