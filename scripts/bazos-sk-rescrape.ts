// Local rescrape driver for bazos.sk after parser fixes.
//
// Iterates the bazos.sk listing pages with a 1s crawl-delay, upserting the
// re-parsed listings (correct titles, prices, thumbnails) into the live DB.
// Existing rows get UPDATE; new rows get INSERT. Detail enrichment runs
// separately via the 6h cron.
//
//   pnpm tsx scripts/bazos-sk-rescrape.ts [pages]
//
// Defaults to 100 pages (~2000 listings; we have ~19 954 in DB so multiple
// runs may be needed, or bump the arg).

import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

import { getSource, runScrape } from '../lib/scraping';
import { upsertListings, recordScrapeRun } from '../lib/scraping/persist';

async function main() {
  // Default 1000 pages × 20 = 20 000 listings (covers full bazos.sk inventory
  // in DB ~19 954) so every existing row gets the new parser's title + price.
  const pagesArg = Number(process.argv[2] ?? 1000);
  const source = getSource('bazos.sk');
  console.log(`Rescraping bazos.sk pages 1..${pagesArg} …`);

  const result = await runScrape(source, { pages: pagesArg });
  console.log(
    `scrape done: ${result.listings.length} listings, ${result.pagesVisited} pages, ${result.errors.length} errors in ${result.finishedAt.getTime() - result.startedAt.getTime()}ms`,
  );

  const counts = await upsertListings(result.listings);
  console.log(`upsert: +${counts.added} new, ~${counts.updated} updated, ${counts.skipped} skipped`);
  if (counts.lastError) console.error('upsert lastError:', counts.lastError);

  await recordScrapeRun('bazos.sk', result, counts);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
