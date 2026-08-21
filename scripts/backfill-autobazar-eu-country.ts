// One-off: establish `country` for autobazar.eu rows without waiting for the
// rotation to walk all 6 776 bucket-pages.
//
// The stored region names cannot answer this. A name-based rule misses
// thousands of Czech towns (Kladno, Znojmo, Otrokovice, Ustí nad Labem…),
// cannot decide names that exist in both countries (Jesenice, Most, Ostrov),
// and mislabels "Moravský Svätý Ján" — a Slovak village — as Czech.
//
// The listing records themselves do answer it: every one carries
// location.parents, whose last element is the country's node id. This walks the
// same brand/model buckets the scraper uses and builds a NAME -> COUNTRY tally
// from that structural evidence, so the stored region names can be resolved in
// bulk instead of one advert at a time.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { config as loadEnv } from 'dotenv';
import { BRAND_MODEL_BUCKETS, resolveCountry } from '../lib/scraping/sources/autobazar-eu';

loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

const BASE = 'https://www.autobazar.eu';
const NEXT_DATA_RE = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/;
const UA = 'Mozilla/5.0 (compatible; CPCProfit/1.0)';

const arg = (name: string, dflt: number): number => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.slice(name.length + 3)) : dflt;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Optional `?location=<root id>` filter. An unfiltered walk is Slovak-dominant,
// so Czech names surface slowly; running a second pass filtered to Czechia
// concentrates them. The filter never decides a row's country — resolveCountry
// still reads location.parents — so a mislabelled filter cannot corrupt the
// tally, and merging both passes is what makes a name seen under two countries
// visible as ambiguous.
const LOCATION = process.argv.find((a) => a.startsWith('--location='))?.slice(11) ?? null;

type Row = { id?: string; location?: unknown };

function pickRows(parsed: unknown): Row[] {
  const pp = (parsed as { props?: { pageProps?: Record<string, unknown> } })?.props?.pageProps;
  if (!pp) return [];
  const direct = (pp.searchRecords as { data?: unknown })?.data;
  if (Array.isArray(direct)) return direct as Row[];
  const queries = (pp.trpcState as { queries?: Array<{ state?: { data?: { data?: unknown } } }> })
    ?.queries;
  for (const q of queries ?? []) {
    const d = q.state?.data?.data;
    if (Array.isArray(d) && d.length > 0) return d as Row[];
  }
  return [];
}

async function fetchPage(url: string): Promise<Row[] | null> {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) return null;
  const m = NEXT_DATA_RE.exec(await res.text());
  if (!m) return null;
  try {
    return pickRows(JSON.parse(m[1]!));
  } catch {
    return null;
  }
}

// The output is a NAME -> COUNTRY tally, not a list of advert ids.
//
// Ids were the first attempt and they are the wrong unit: only 2 256 of 2 400
// ids collected in one pass existed in our corpus at all, because the site's
// live set and ours overlap only partly. Location names are a few hundred
// values that cover every stored row, and a name observed under two different
// countries is exactly the ambiguity ("Jesenice", "Most", "Ostrov") that must
// be left alone rather than guessed.
const OUT = process.env.COUNTRY_OUT ?? 'autobazar-eu-locations.json';

function persist(tally: Map<string, Record<string, number>>): number {
  writeFileSync(OUT, JSON.stringify(Object.fromEntries(tally), null, 0), 'utf8');
  return tally.size;
}

async function main() {
  const startBucket = arg('start', 0);
  const deadlineMin = arg('deadline-min', 8);
  const pagesPerBucket = arg('pages', 6);
  const deadline = Date.now() + deadlineMin * 60_000;

  let seen = 0;
  let fetches = 0;
  let unresolved = 0;
  let bucket = startBucket;

  // Resume across runs: a previous pass's tallies are the starting point, so
  // evidence accumulates instead of the last chunk overwriting the rest.
  const tally = new Map<string, Record<string, number>>();
  if (existsSync(OUT)) {
    for (const [name, counts] of Object.entries(
      JSON.parse(readFileSync(OUT, 'utf8')) as Record<string, Record<string, number>>,
    )) {
      tally.set(name, counts);
    }
  }

  for (; bucket < BRAND_MODEL_BUCKETS.length; bucket++) {
    if (Date.now() > deadline) break;
    const b = BRAND_MODEL_BUCKETS[bucket]!;
    const path = b.model ? `${b.brand}/${b.model}` : b.brand;

    for (let page = 1; page <= pagesPerBucket; page++) {
      if (Date.now() > deadline) break;
      // No country filter: an unfiltered walk sees both countries, which is
      // what makes a name observed under two of them detectable.
      // `page=1` 404s — the canonical first page carries no page parameter.
      const params = [
        LOCATION ? `location=${LOCATION}` : null,
        page === 1 ? null : `page=${page}`,
      ].filter(Boolean);
      const suffix = params.length > 0 ? `?${params.join('&')}` : '';
      const url = `${BASE}/vysledky/osobne-vozidla/${path}/${suffix}`;
      const rows = await fetchPage(url);
      fetches++;
      await sleep(300);
      // A 404 or an empty page is the normal end of a bucket, not a failure.
      if (rows == null || rows.length === 0) break;

      for (const r of rows) {
        seen++;
        const loc = r.location as { name?: string | null } | null | undefined;
        const name = loc?.name?.trim();
        if (!name) continue;
        const country = resolveCountry(r.location as never);
        if (!country) {
          unresolved++;
          continue;
        }
        const counts = tally.get(name) ?? {};
        counts[country] = (counts[country] ?? 0) + 1;
        tally.set(name, counts);
      }
    }
    // Persist every bucket so a killed run loses at most one bucket's evidence.
    persist(tally);
  }
  persist(tally);

  const ambiguous = [...tally.values()].filter((c) => Object.keys(c).length > 1).length;
  console.log(
    JSON.stringify({
      startBucket,
      nextBucket: bucket,
      totalBuckets: BRAND_MODEL_BUCKETS.length,
      fetches,
      seen,
      unresolved,
      names: tally.size,
      ambiguous,
      out: OUT,
    }),
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
