// Local CLI for the autobazar.sk scraper.
// Run with:  pnpm tsx scripts/scrape-autobazar.ts [pages]
//
// Prints a JSON summary of normalized listings without touching the database.
// Use this to tune DOM selectors against the live page during development.

import { scrapeAutobazarSk } from '../lib/scraping';

async function main() {
  const pages = Number(process.argv[2] ?? 1);
  console.error(`Scraping autobazar.sk pages 1..${pages} …`);
  const result = await scrapeAutobazarSk({ pages });
  console.error(
    `done in ${result.finishedAt.getTime() - result.startedAt.getTime()}ms — ` +
      `${result.listings.length} listings across ${result.pagesVisited} pages, ` +
      `${result.errors.length} errors`,
  );
  if (result.errors.length) console.error('errors:', result.errors);
  console.log(JSON.stringify(result.listings, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
