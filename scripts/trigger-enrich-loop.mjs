// Drive /api/cron/enrich-source in a loop until done. Reads CRON_SECRET
// from .env.local (never logs it). Run with:
//   node scripts/trigger-enrich-loop.mjs <source>

import { readFileSync } from 'node:fs';

const source = process.argv[2];
if (!source) {
  console.error('usage: node scripts/trigger-enrich-loop.mjs <source>');
  process.exit(2);
}

const env = readFileSync('.env.local', 'utf8');
const m = /^CRON_SECRET=(.+)$/m.exec(env);
if (!m) {
  console.error('CRON_SECRET not found in .env.local');
  process.exit(1);
}
const secret = m[1].replace(/^["']|["']$/g, '');

const ENDPOINT = 'https://cpcprofitie.vercel.app/api/cron/enrich-source';
const startedAt = Date.now();
let runningTotal = 0;
let invocation = 0;

async function callOnce() {
  invocation++;
  const ts = new Date().toISOString().slice(11, 19);
  const start = Date.now();
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + secret,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ source }),
    });
    const text = await res.text();
    const ms = Date.now() - start;
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      console.log(`[${source}][${ts}] inv ${invocation}: bad response after ${ms}ms — ${text.slice(0, 200)}`);
      return { done: false, fatal: text.includes('TIMEOUT') ? false : true };
    }
    if (parsed.error) {
      console.log(`[${source}][${ts}] inv ${invocation}: ERROR ${parsed.error} ${parsed.message ?? ''}`);
      return { done: false, fatal: parsed.error === 'unauthorized' };
    }
    runningTotal += parsed.totalDetails ?? 0;
    const totalSecs = ((Date.now() - startedAt) / 1000).toFixed(0);
    console.log(
      `[${source}][${ts}] inv ${invocation}: ${parsed.totalFetched}/${parsed.batches * 10} fetched, ${parsed.totalDetails} details, ${parsed.totalErrors} errors, ${(ms / 1000).toFixed(0)}s. ` +
        `done=${parsed.done}. running total=${runningTotal} in ${totalSecs}s`,
    );
    return { done: parsed.done === true, fatal: false };
  } catch (e) {
    console.log(`[${source}][${ts}] inv ${invocation}: FETCH ERROR ${e.message}`);
    return { done: false, fatal: false };
  }
}

while (true) {
  const result = await callOnce();
  if (result.done) {
    console.log(`[${source}] ALL DONE after ${invocation} invocations, total ${runningTotal} enriched`);
    break;
  }
  if (result.fatal) {
    console.log(`[${source}] FATAL — aborting`);
    process.exit(1);
  }
  // brief breath between calls
  await new Promise((r) => setTimeout(r, 3000));
}
