// Local CLI for any registered scraper source.
// Run with:  pnpm tsx scripts/scrape-source.ts <source> [pages]
//
// Examples:
//   pnpm tsx scripts/scrape-source.ts autobazar.sk 2
//   pnpm tsx scripts/scrape-source.ts sauto.cz 1
//
// Prints a JSON summary of normalized listings without touching the database.
// Use this to tune DOM selectors against the live page during development.

import { ALL_SOURCES, getSource, runScrape, type Source } from '../lib/scraping';

async function main() {
  const sourceArg = process.argv[2];
  const pagesArg = Number(process.argv[3] ?? 1);

  if (!sourceArg) {
    console.error('usage: pnpm tsx scripts/scrape-source.ts <source> [pages]');
    console.error('available sources:', ALL_SOURCES.join(', '));
    process.exit(2);
  }

  if (!ALL_SOURCES.includes(sourceArg as Source)) {
    console.error(`unknown source: ${sourceArg}`);
    console.error('available sources:', ALL_SOURCES.join(', '));
    process.exit(2);
  }

  const source = getSource(sourceArg as Source);
  console.error(`Scraping ${source.id} pages 1..${pagesArg} …`);
  const result = await runScrape(source, { pages: pagesArg });
  console.error(
    `done in ${result.finishedAt.getTime() - result.startedAt.getTime()}ms — ` +
      `${result.listings.length} listings across ${result.pagesVisited} pages, ` +
      `${result.errors.length} errors`,
  );
  if (result.errors.length > 0) console.error('errors:', result.errors);
  console.log(JSON.stringify(result.listings, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
