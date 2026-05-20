// Overnight detail enrichment for autobazar.sk listings.
// pnpm tsx scripts/autobazar-sk-enrich-all.ts [maxListings]

import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

import { autobazarSk } from '../lib/scraping';
import { enrichAll } from './_enrich-runner';

const max = process.argv[2] ? Number(process.argv[2]) : undefined;

enrichAll(autobazarSk, { maxListings: max }).catch((e) => {
  console.error('autobazar-sk-enrich-all crashed:', e);
  process.exit(1);
});
