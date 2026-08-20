// Walk each source's page cursor forward until its cycle completes.
//
// The cron does this on its own schedule, four passes a day per source. This
// drives the same endpoint continuously, for catching up after a long gap or
// for a first full sweep — the cursor is shared, so a run here simply advances
// the same position the cron would have.
//
// Sources are visited round-robin rather than one-at-a-time so that a slow
// source cannot starve the others, and so the request rate against any single
// host stays roughly a third of the total.
import { readFileSync } from 'node:fs';

const env = readFileSync('.env.local', 'utf8');
const m = /^CRON_SECRET=(.+)$/m.exec(env);
if (!m) {
  console.error('CRON_SECRET not found in .env.local');
  process.exit(1);
}
const secret = m[1].replace(/^["']|["']$/g, '');
const BASE = 'https://cpcprofitie.vercel.app/api/cron/dispatch-scrape';

const SOURCES = (process.env.SOURCES ?? 'bazos.sk,autobazar.sk,autobazar.eu').split(',');
const PAGES = Number(process.env.PAGES ?? '80');
const HOURS = Number(process.env.HOURS ?? '3');
const deadline = Date.now() + HOURS * 3600_000;

const totals = Object.fromEntries(SOURCES.map((s) => [s, { added: 0, updated: 0, runs: 0 }]));
const done = new Set();

let round = 0;
while (Date.now() < deadline && done.size < SOURCES.length) {
  round++;
  for (const source of SOURCES) {
    if (done.has(source) || Date.now() >= deadline) continue;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 295_000);
    try {
      const res = await fetch(`${BASE}?source=${encodeURIComponent(source)}&pages=${PAGES}`, {
        headers: { Authorization: `Bearer ${secret}` },
        signal: ac.signal,
      });
      const text = await res.text();
      if (!res.ok) {
        console.log(`[${source}] HTTP ${res.status} — ${text.slice(0, 160)}`);
        continue;
      }
      const j = JSON.parse(text);
      const t = totals[source];
      t.added += j.counts?.added ?? 0;
      t.updated += j.counts?.updated ?? 0;
      t.runs++;
      console.log(
        `r${round} [${source}] ${j.startPage}->${j.nextPage} ok=${j.pages?.ok} empty=${j.pages?.empty} ` +
          `404=${j.pages?.notFound} err=${j.pages?.error} +${j.counts?.added} ~${j.counts?.updated} ` +
          `cycle=${j.cycleNo}${j.cycleWrapped ? ' WRAPPED' : ''} ${j.stoppedReason}`,
      );
      // A wrapped cycle means this source has been walked end to end.
      if (j.cycleWrapped) {
        done.add(source);
        console.log(`[${source}] full cycle complete`);
      }
    } catch (e) {
      console.log(`[${source}] ERROR ${e instanceof Error ? e.message : e}`);
    } finally {
      clearTimeout(timer);
    }
  }
}

console.log('--- scrape cycle summary ---');
for (const s of SOURCES) {
  const t = totals[s];
  console.log(`${s}: runs=${t.runs} added=${t.added} updated=${t.updated}${done.has(s) ? ' (cycle complete)' : ''}`);
}
