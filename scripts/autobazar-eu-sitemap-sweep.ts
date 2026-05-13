// One-shot sweep of autobazar.eu's public sitemap. Pulls every osobné +
// SUV listing URL (≈65k) plus all embedded image URLs and bulk-inserts
// them into the listings + listing_photos tables. Meta fields (price,
// year, mileage, VIN, etc.) get filled in by a separate detail-enrich
// pass (scripts/autobazar-eu-enrich-all.ts).
//
// Run:
//   pnpm tsx scripts/autobazar-eu-sitemap-sweep.ts
//
// Resumable: ON CONFLICT (source, source_id) skips rows already present.
// listing_photos uses ON CONFLICT (listing_id, position) DO NOTHING so
// running this twice doesn't double-insert.

import { config as loadEnv } from 'dotenv';
import { sql } from 'drizzle-orm';
import { setTimeout as sleep } from 'node:timers/promises';
import { getDb } from '../lib/db';
import { listingPhotos, listings } from '../lib/db/schema';
import { USER_AGENT } from '../lib/scraping';

loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

const BASE = 'https://www.autobazar.eu';
const SITEMAP_INDEX = `${BASE}/sitemapindex/sitemap-listings-index-sk.xml`;

// /detail/<slug>/<alphaId>/ or /detail-aaa/<slug>/<alphaId>/
const LISTING_URL_RE =
  /^https:\/\/www\.autobazar\.eu\/(?:detail|detail-aaa)\/[^/]+\/([\w-]+)\/?$/;

const CRAWL_DELAY_MS = 1000;
const BATCH_SIZE = 500;
const PHOTOS_PER_LISTING_MAX = 30;

type ParsedListing = {
  sourceId: string;
  url: string;
  photos: string[];
};

async function fetchText(url: string): Promise<string> {
  const r = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/xml,text/xml,*/*' },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return r.text();
}

function parseSitemapIndex(xml: string): string[] {
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
  // Only osobné vozidlá + SUV. Skip nahradné diely, motocykle, kamiony, etc.
  return locs.filter(
    (u) =>
      u.includes('sitemap-listings-osobne-vozidla-sk-') ||
      u.includes('sitemap-listings-suv-terenne-vozidla-sk-'),
  );
}

function parseSubSitemap(xml: string): ParsedListing[] {
  const out: ParsedListing[] = [];
  // <url><loc>...</loc><lastmod>...</lastmod><image:image>...</image:image>...</url>
  const urlBlocks = xml.matchAll(/<url>([\s\S]*?)<\/url>/g);
  for (const match of urlBlocks) {
    const block = match[1]!;
    const locMatch = /<loc>([^<]+)<\/loc>/.exec(block);
    if (!locMatch) continue;
    const url = locMatch[1]!;
    const idMatch = LISTING_URL_RE.exec(url);
    if (!idMatch) continue;
    const sourceId = idMatch[1]!;
    const photos = [
      ...block.matchAll(/<image:loc>([^<]+)<\/image:loc>/g),
    ]
      .map((m) => decodeXmlEntities(m[1]!))
      .slice(0, PHOTOS_PER_LISTING_MAX);
    // Canonicalise the URL into the redirect-friendly /detail/x/<id>/ form
    // so existing detail enrichment can re-use it without slug drift.
    const canonical = `${BASE}/detail/x/${sourceId}/`;
    out.push({ sourceId, url: canonical, photos });
  }
  return out;
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

async function insertListingsBatch(
  db: ReturnType<typeof getDb>,
  rows: ParsedListing[],
): Promise<Map<string, bigint>> {
  const values = rows.map((r) => ({
    source: 'autobazar.eu' as const,
    sourceId: r.sourceId,
    url: r.url,
    // Meta fields stay null until the detail enrich pass fills them.
    modelId: null,
    priceEur: null,
    year: null,
    mileageKm: null,
    fuel: null,
    transmission: null,
    region: null,
    rawJson: { capturedAt: new Date().toISOString(), via: 'sitemap' },
  }));

  // onConflictDoUpdate refreshes last_seen_at + url; we don't clobber
  // any meta fields that an enrich pass may already have set.
  const result = await db
    .insert(listings)
    .values(values)
    .onConflictDoUpdate({
      target: [listings.source, listings.sourceId],
      set: {
        url: sql`excluded.url`,
        lastSeenAt: sql`now()`,
      },
    })
    .returning({ id: listings.id, sourceId: listings.sourceId });

  const idMap = new Map<string, bigint>();
  for (const row of result) idMap.set(row.sourceId, row.id);
  return idMap;
}

async function insertPhotosBatch(
  db: ReturnType<typeof getDb>,
  rows: ParsedListing[],
  idMap: Map<string, bigint>,
): Promise<number> {
  type PhotoRow = { listingId: bigint; position: number; url: string };
  const photoRows: PhotoRow[] = [];
  for (const r of rows) {
    const id = idMap.get(r.sourceId);
    if (!id) continue;
    for (let i = 0; i < r.photos.length; i++) {
      photoRows.push({ listingId: id, position: i + 1, url: r.photos[i]!.slice(0, 2000) });
    }
  }
  if (photoRows.length === 0) return 0;
  // ON CONFLICT (listing_id, position) DO NOTHING — first writer wins,
  // re-running the sweep won't double-insert.
  await db
    .insert(listingPhotos)
    .values(photoRows)
    .onConflictDoNothing({ target: [listingPhotos.listingId, listingPhotos.position] });
  return photoRows.length;
}

async function main() {
  const db = getDb();

  console.error(`Fetching sitemap index: ${SITEMAP_INDEX}`);
  const indexXml = await fetchText(SITEMAP_INDEX);
  const subSitemaps = parseSitemapIndex(indexXml);
  console.error(`Found ${subSitemaps.length} car sub-sitemaps`);
  await sleep(CRAWL_DELAY_MS);

  let totalParsed = 0;
  let totalListingsUpserted = 0;
  let totalPhotosInserted = 0;

  for (const smUrl of subSitemaps) {
    console.error(`\n=== ${smUrl}`);
    const t0 = Date.now();
    let xml: string;
    try {
      xml = await fetchText(smUrl);
    } catch (e) {
      console.error(`  fetch failed: ${e instanceof Error ? e.message : e}`);
      continue;
    }
    const listingsParsed = parseSubSitemap(xml);
    console.error(
      `  parsed ${listingsParsed.length} listings (${(Date.now() - t0) / 1000}s, ${(xml.length / 1024 / 1024).toFixed(1)}MB)`,
    );
    totalParsed += listingsParsed.length;

    for (let i = 0; i < listingsParsed.length; i += BATCH_SIZE) {
      const chunk = listingsParsed.slice(i, i + BATCH_SIZE);
      try {
        const idMap = await insertListingsBatch(db, chunk);
        totalListingsUpserted += idMap.size;
        const ph = await insertPhotosBatch(db, chunk, idMap);
        totalPhotosInserted += ph;
        process.stderr.write(
          `\r  batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(listingsParsed.length / BATCH_SIZE)}: ` +
            `+${idMap.size} listings, +${ph} photos`,
        );
      } catch (e) {
        console.error(`\n  batch fail: ${e instanceof Error ? e.message : e}`);
      }
    }
    console.error(); // newline after batch progress
    await sleep(CRAWL_DELAY_MS);
  }

  console.error(
    `\nDone. Parsed ${totalParsed} listings. Upserted ${totalListingsUpserted} listing rows, inserted ${totalPhotosInserted} photos.`,
  );
}

main().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});
