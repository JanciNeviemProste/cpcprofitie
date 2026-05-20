// Overnight detail enrichment for autobazar.eu listings (sitemap-only rows
// without meta). pnpm tsx scripts/autobazar-eu-enrich-all.ts [maxListings]

import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

import { autobazarEu } from '../lib/scraping';
import { enrichAll } from './_enrich-runner';

const max = process.argv[2] ? Number(process.argv[2]) : undefined;

enrichAll(autobazarEu, { maxListings: max }).catch((e) => {
  console.error('autobazar-eu-enrich-all crashed:', e);
  process.exit(1);
});
