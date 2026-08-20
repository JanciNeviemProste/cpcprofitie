// Clear duplicate links that no longer hold. Run AFTER trigger-refresh.mjs.
//
// One-way and idempotent — a second run finds nothing left to clear.

import { readFileSync } from 'node:fs';

const env = readFileSync('.env.local', 'utf8');
const m = /^CRON_SECRET=(.+)$/m.exec(env);
if (!m) {
  console.error('CRON_SECRET not found in .env.local');
  process.exit(1);
}
const secret = m[1].replace(/^["']|["']$/g, '');
const BASE = 'https://cpcprofitie.vercel.app/api/admin/unmerge-false-clusters';

let afterId;
let total = 0;
for (let i = 1; i <= 200; i++) {
  const url = afterId ? `${BASE}?limit=5000&afterId=${afterId}` : `${BASE}?limit=5000`;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 290_000);
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${secret}` },
      signal: ac.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      console.log(`inv ${i}: HTTP ${res.status} — ${text.slice(0, 200)}`);
      break;
    }
    const { stats } = JSON.parse(text);
    total += stats?.unmerged ?? 0;
    console.log(
      `inv ${i}: scanned=${stats?.scanned ?? '?'} unmerged=${stats?.unmerged ?? 0} ` +
        `total=${total}`,
    );
    // These walks have no "remaining" to count: the refresh visits every row
    // and the unmerge re-queries a shrinking set, so the only honest end
    // condition is a batch that returned nothing.
    if (!stats?.scanned) break;
    afterId = stats?.nextCursor;
    if (afterId == null) break;
  } catch (e) {
    console.log(`inv ${i}: FETCH ERROR ${e.message ?? e}`);
    break;
  } finally {
    clearTimeout(t);
  }
}
console.log(`unmerge-false-clusters hotovo, spolu updatnutych: ${total}`);
