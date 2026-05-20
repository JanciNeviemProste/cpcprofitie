// Overnight detail enrichment for bazos.sk listings.
// pnpm tsx scripts/bazos-sk-enrich-all.ts [maxListings]

import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

import { bazosSk } from '../lib/scraping';
import { enrichAll } from './_enrich-runner';

const max = process.argv[2] ? Number(process.argv[2]) : undefined;

enrichAll(bazosSk, { maxListings: max }).catch((e) => {
  console.error('bazos-sk-enrich-all crashed:', e);
  process.exit(1);
});
