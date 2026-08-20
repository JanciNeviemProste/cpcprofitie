// Mark listings that are car parts rather than cars.
//
// /api/admin/classify-vehicles reads raw_title only, so this crawls nothing.
// One-way: it clears is_vehicle and never sets it back, so a correction made
// by hand in the database survives the next run.
//
// Bounded per call, so loop on the cursor the endpoint hands back.
import { readFileSync } from 'node:fs';

const env = readFileSync('.env.local', 'utf8');
const m = /^CRON_SECRET=(.+)$/m.exec(env);
if (!m) {
  console.error('CRON_SECRET not found in .env.local');
  process.exit(1);
}
const secret = m[1].replace(/^["']|["']$/g, '');
const BASE = 'https://cpcprofitie.vercel.app/api/admin/classify-vehicles';

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
    total += stats?.updated ?? 0;
    console.log(
      `inv ${i}: scanned=${stats?.scanned ?? '?'} updated=${stats?.updated ?? 0} ` +
        `remaining=${stats?.remaining ?? '?'} total=${total}`,
    );
    if (!stats?.remaining || stats.remaining === 0) break;
    afterId = stats?.nextCursor;
    if (afterId == null) break;
  } catch (e) {
    console.log(`inv ${i}: FETCH ERROR ${e.message ?? e}`);
    break;
  } finally {
    clearTimeout(t);
  }
}
console.log(`classify-vehicles hotovo, spolu updatnutych: ${total}`);
