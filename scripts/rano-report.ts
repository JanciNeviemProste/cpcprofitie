// Morning report for the overnight run. Written to a file so the state is
// legible without re-deriving it from logs.
import { config as loadEnv } from 'dotenv';
import { sql } from 'drizzle-orm';
import { getDb } from '../lib/db';
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

const pct = (a: number, b: number) => (b === 0 ? '—' : `${((100 * a) / b).toFixed(1)} %`);

async function main() {
  const db = getDb();
  const q = async <T>(s: ReturnType<typeof sql>) => (await db.execute(s)) as unknown as T[];

  console.log(`REPORT  ${new Date().toISOString()}`);
  console.log('='.repeat(64));

  const per = await q<{
    source: string; inzeraty: number; detail: number; cena: number;
    model: number; rok: number; km: number; fotky: number;
  }>(sql`
    SELECT l.source,
           count(*)::int AS inzeraty,
           count(d.listing_id)::int AS detail,
           count(l.price_eur)::int AS cena,
           count(l.model_id)::int AS model,
           count(l.year)::int AS rok,
           count(l.mileage_km)::int AS km,
           (SELECT count(*)::int FROM listing_photos p
              JOIN listings l2 ON l2.id = p.listing_id WHERE l2.source = l.source) AS fotky
    FROM listings l LEFT JOIN listing_details d ON d.listing_id = l.id
    GROUP BY l.source ORDER BY l.source
  `);

  console.log('\nPOKRYTIE PO ZDROJOCH');
  for (const r of per) {
    console.log(`\n  ${r.source}  (${r.inzeraty} inzeratov, ${r.fotky} fotiek)`);
    console.log(`    detail ${pct(r.detail, r.inzeraty)}   cena ${pct(r.cena, r.inzeraty)}   model ${pct(r.model, r.inzeraty)}`);
    console.log(`    rok    ${pct(r.rok, r.inzeraty)}   km   ${pct(r.km, r.inzeraty)}`);
  }

  const tot = per.reduce(
    (a, r) => ({
      inzeraty: a.inzeraty + r.inzeraty, detail: a.detail + r.detail, cena: a.cena + r.cena,
      model: a.model + r.model, rok: a.rok + r.rok, km: a.km + r.km, fotky: a.fotky + r.fotky,
    }),
    { inzeraty: 0, detail: 0, cena: 0, model: 0, rok: 0, km: 0, fotky: 0 },
  );
  console.log(`\n  SPOLU  ${tot.inzeraty} inzeratov, ${tot.fotky} fotiek`);
  console.log(`    detail ${pct(tot.detail, tot.inzeraty)}   cena ${pct(tot.cena, tot.inzeraty)}   model ${pct(tot.model, tot.inzeraty)}`);
  console.log(`    rok    ${pct(tot.rok, tot.inzeraty)}   km   ${pct(tot.km, tot.inzeraty)}`);

  const cat = await q<{ znaciek: number; modelov: number; bez_fp: number }>(sql`
    SELECT (SELECT count(*)::int FROM vehicle_makes) AS znaciek,
           (SELECT count(*)::int FROM vehicle_models) AS modelov,
           (SELECT count(*)::int FROM listings WHERE fingerprint IS NULL) AS bez_fp
  `);
  console.log(`\nKATALOG   ${cat[0]!.znaciek} znaciek, ${cat[0]!.modelov} modelov`);
  console.log(`FINGERPRINTY  chyba: ${cat[0]!.bez_fp}`);

  const flips = await q<{ n: number; s: number | null; med: number | null; max: number | null }>(sql`
    SELECT count(*)::int AS n,
           count(deal_score)::int AS s,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY deal_score)::int AS med,
           max(deal_score)::int AS max
    FROM flip_opportunities
  `);
  const f = flips[0]!;
  console.log(`\nFLIP PRILEZITOSTI  ${f.n}  (s DealScore: ${f.s})`);
  if (f.n > 0) console.log(`   DealScore  median ${f.med ?? '—'}   max ${f.max ?? '—'}`);
  else console.log('   !!! ZIADNE — analytika nedobehla, pozri log');

  const snaps = await q<{ n: number }>(sql`SELECT count(*)::int AS n FROM market_snapshots`);
  console.log(`MARKET SNAPSHOTS   ${snaps[0]!.n}`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error('REPORT ZLYHAL:', e instanceof Error ? e.message : e);
  process.exit(1);
});
