// Regenerate `BRAND_MODEL_BUCKETS` for autobazar.eu by probing every brand
// SEF and its top-15 models from getAggregations. Run when the catalog
// drifts (rough cadence: every few months, or after seeing many 4xx errors
// in scrape_runs for autobazar.eu).
//
// Usage:
//   pnpm tsx scripts/gen-autobazar-eu-buckets.ts > /tmp/buckets.ts
//   # then paste the body of /tmp/buckets.ts into lib/scraping/sources/autobazar-eu.ts

import { setTimeout as sleep } from 'node:timers/promises';
import { USER_AGENT } from '../lib/scraping';

const BASE = 'https://www.autobazar.eu';
const NEXT_DATA_RE = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/;

type Aggregation = { sef: string; count: number };

type TrpcQuery = {
  queryKey?: unknown[];
  state?: { data?: { aggregations?: unknown } };
};
type NextDataEnvelope = {
  props?: { pageProps?: { trpcState?: { queries?: TrpcQuery[] } } };
};

async function fetchAggs(url: string): Promise<Aggregation[]> {
  const r = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!r.ok) return [];
  const html = await r.text();
  const m = NEXT_DATA_RE.exec(html);
  if (!m) return [];
  let data: NextDataEnvelope;
  try {
    data = JSON.parse(m[1]!) as NextDataEnvelope;
  } catch {
    return [];
  }
  const queries = data?.props?.pageProps?.trpcState?.queries ?? [];
  for (const q of queries) {
    const key = q?.queryKey?.[0];
    if (
      Array.isArray(key) &&
      key[0] === 'search' &&
      key[1] === 'getAggregations'
    ) {
      const aggs = q?.state?.data?.aggregations;
      if (Array.isArray(aggs)) {
        return (aggs as Aggregation[]).filter((a) => typeof a?.sef === 'string');
      }
    }
  }
  return [];
}

async function main() {
  console.error('Fetching brand list from /vysledky/osobne-vozidla/ ...');
  const brands = await fetchAggs(`${BASE}/vysledky/osobne-vozidla/`);
  brands.sort((a, b) => b.count - a.count);
  console.error(`  ${brands.length} brands`);

  type Pair = { brand: string; model: string | null; count: number };
  const pairs: Pair[] = [];
  for (const b of brands) {
    pairs.push({ brand: b.sef, model: null, count: Number.MAX_SAFE_INTEGER });
    const models = await fetchAggs(`${BASE}/vysledky/osobne-vozidla/${b.sef}/`);
    models.sort((a, b) => b.count - a.count);
    for (const m of models.slice(0, 15)) {
      pairs.push({ brand: b.sef, model: m.sef, count: m.count });
    }
    console.error(`  ${b.sef}: ${Math.min(models.length, 15)} models`);
    await sleep(1000); // crawl-delay courtesy
  }

  // Dedup
  const seen = new Set<string>();
  const unique = pairs.filter((p) => {
    const k = `${p.brand}::${p.model ?? ''}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  unique.sort((a, b) => {
    if ((a.model === null) !== (b.model === null)) return a.model === null ? -1 : 1;
    return b.count - a.count;
  });

  console.log(
    "export const BRAND_MODEL_BUCKETS: ReadonlyArray<{ brand: string; model: string | null }> = [",
  );
  for (const p of unique) {
    const m = p.model === null ? 'null' : `'${p.model}'`;
    console.log(`  { brand: '${p.brand}', model: ${m} },`);
  }
  console.log('];');
  console.error(`\nTotal: ${unique.length} buckets`);
}

main().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});
