// One-shot trigger for /api/cron/weekly-maintenance to refresh
// market_snapshots + flip_opportunities (including the new DealScore
// columns from migration 0009). Reads CRON_SECRET from .env.local.
import { readFileSync } from 'node:fs';

const env = readFileSync('.env.local', 'utf8');
const m = /^CRON_SECRET=(.+)$/m.exec(env);
if (!m) {
  console.error('CRON_SECRET not found in .env.local');
  process.exit(1);
}
const secret = m[1].replace(/^["']|["']$/g, '');

const ENDPOINT = 'https://cpcprofitie.vercel.app/api/cron/weekly-maintenance';
console.log('triggering weekly-maintenance...');
const start = Date.now();
const ac = new AbortController();
const t = setTimeout(() => ac.abort(), 290_000);
try {
  const res = await fetch(ENDPOINT, {
    headers: { Authorization: 'Bearer ' + secret },
    signal: ac.signal,
  });
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const text = await res.text();
  console.log(`HTTP ${res.status} in ${elapsed}s`);
  console.log(text.slice(0, 2000));
} catch (e) {
  console.error('fetch failed:', e.message ?? e);
  process.exit(1);
} finally {
  clearTimeout(t);
}
