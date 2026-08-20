// Re-resolve model_id from titles already stored in the database.
//
// No crawling: /api/admin/backfill-model-id runs parseMakeModel over raw_title,
// so listings whose identity was wrong (a make called `predam`) or cleared by
// the catalog merge get a second chance without re-fetching a single page.
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
const BASE = 'https://cpcprofitie.vercel.app/api/admin/backfill-model-id';

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
console.log(`backfill-model-id hotovo, spolu updatnutych: ${total}`);
