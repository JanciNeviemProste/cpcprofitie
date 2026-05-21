// Drive /api/cron/dispatch-scrape in a loop, walking startPage=1,31,61,...
// to re-scrape all pages of a source with the latest parser. Used to refresh
// stale raw_title/price/year on existing listings (upsertListings does
// onConflictDoUpdate so already-known sourceIds get patched).
//
// Usage: node scripts/trigger-rescrape-loop.mjs <source> [maxStartPage=991]

import { readFileSync } from 'node:fs';

const source = process.argv[2];
const maxStartPage = Number(process.argv[3] ?? 991);
if (!source) {
  console.error('usage: node scripts/trigger-rescrape-loop.mjs <source> [maxStartPage]');
  process.exit(2);
}

const env = readFileSync('.env.local', 'utf8');
const m = /^CRON_SECRET=(.+)$/m.exec(env);
if (!m) {
  console.error('CRON_SECRET not found in .env.local');
  process.exit(1);
}
const secret = m[1].replace(/^["']|["']$/g, '');

const BASE = 'https://cpcprofitie.vercel.app/api/cron/dispatch-scrape';
const PAGES_PER_RUN = 30;
const FETCH_TIMEOUT_MS = 290_000;
const startedAt = Date.now();
let totalAdded = 0;
let totalUpdated = 0;
let consecutiveErrors = 0;

async function callOnce(startPage) {
  const ts = new Date().toISOString().slice(11, 19);
  const t0 = Date.now();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}?source=${encodeURIComponent(source)}&startPage=${startPage}`, {
      headers: { Authorization: 'Bearer ' + secret },
      signal: ac.signal,
    });
    const text = await res.text();
    const ms = Date.now() - t0;
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      console.log(`[${source}][${ts}] startPage=${startPage}: bad response (${ms}ms) — ${text.slice(0, 200)}`);
      consecutiveErrors++;
      return { listingsFound: 0, fatal: consecutiveErrors >= 10 };
    }
    consecutiveErrors = 0;
    const row = parsed.summary?.[0];
    if (!row) {
      console.log(`[${source}][${ts}] startPage=${startPage}: empty summary, ${ms}ms`);
      return { listingsFound: 0, fatal: false };
    }
    totalAdded += row.counts?.added ?? 0;
    totalUpdated += row.counts?.updated ?? 0;
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0);
    console.log(
      `[${source}][${ts}] startPage=${startPage}: ${row.listingsFound} found, +${row.counts?.added ?? 0}/~${row.counts?.updated ?? 0}, ${(ms / 1000).toFixed(0)}s. ` +
        `running added=${totalAdded} updated=${totalUpdated} in ${elapsed}s`,
    );
    return { listingsFound: row.listingsFound ?? 0, fatal: false };
  } catch (e) {
    consecutiveErrors++;
    console.log(`[${source}][${ts}] startPage=${startPage}: FETCH ERROR ${e.message} (consec=${consecutiveErrors})`);
    return { listingsFound: 0, fatal: consecutiveErrors >= 10 };
  } finally {
    clearTimeout(timer);
  }
}

for (let startPage = 1; startPage <= maxStartPage; startPage += PAGES_PER_RUN) {
  const r = await callOnce(startPage);
  if (r.fatal) {
    console.log(`[${source}] FATAL — too many consecutive errors, aborting`);
    process.exit(1);
  }
  if (r.listingsFound === 0) {
    console.log(`[${source}] EMPTY page reached at startPage=${startPage}, stopping early`);
    break;
  }
  const breath = consecutiveErrors === 0 ? 2000 : consecutiveErrors === 1 ? 10_000 : 30_000;
  await new Promise((r) => setTimeout(r, breath));
}
console.log(`[${source}] DONE. Total added=${totalAdded}, updated=${totalUpdated} in ${((Date.now() - startedAt) / 1000).toFixed(0)}s`);
