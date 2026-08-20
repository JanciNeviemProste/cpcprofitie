// One-shot repair of the vehicle catalog.
//
// parseMakeModel used to take the first two words of a listing title and
// ensureModelId created a catalog row for whatever came out, so the catalog grew
// from the seeded 15 makes / 52 models to 1 881 / 6 829: verbs from titles
// (`predam`, `rozpredam`), parts rather than cars (`letne`, `hlinikove`), and —
// the expensive one — split identities, 1 791 VW listings across `vw` and
// `volkswagen`, 950 Mercedes across `mercedes` and `mercedes-benz`.
//
// A split identity halves a cohort, which moves the median every DealScore is
// measured against. That is the whole reason this runs.
//
// The parser itself is already fixed (450573c); this only repairs rows written
// before it. Brand truth comes from resolveBrand(), so there is no second
// opinion anywhere about what counts as a brand.
//
//   pnpm tsx scripts/merge-vehicle-catalog.ts [--dry-run]

import { config as loadEnv } from 'dotenv';
import { sql } from 'drizzle-orm';
import { getDb } from '../lib/db';
import { resolveBrand } from '../lib/scraping/vehicle-dictionary';

loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

const DRY = process.argv.includes('--dry-run');
const log = (s: string) => console.log(`[merge] ${s}`);

type MakeRow = { id: number; slug: string };
type ModelRow = { id: number; make_id: number; slug: string; make_slug: string };

/**
 * Reduce a model slug to its bare form so duplicates collapse onto one row.
 *
 * Two prefixes have to come off, not one. "volkswagen-golf" carries the
 * canonical brand, but rows created under an alias make carry the alias instead
 * ("vw-golf" under make "vw", "mercedes-sprinter" under "mercedes"). Stripping
 * only the canonical prefix leaves "vw-golf" unmatched against the seeded
 * "golf", which is exactly how VW stayed split across two makes.
 */
function bareSlug(brand: string, makeSlug: string, slug: string): string {
  for (const prefix of [`${brand}-`, `${makeSlug}-`]) {
    if (prefix.length > 1 && slug.startsWith(prefix)) return slug.slice(prefix.length);
  }
  return slug;
}

async function main() {
  const db = getDb();

  const makes = (await db.execute(
    sql`SELECT id, slug FROM vehicle_makes ORDER BY id`,
  )) as unknown as MakeRow[];
  const models = (await db.execute(sql`
    SELECT vm.id, vm.make_id, vm.slug, m.slug AS make_slug
    FROM vehicle_models vm JOIN vehicle_makes m ON m.id = vm.make_id ORDER BY vm.id
  `)) as unknown as ModelRow[];
  log(`vstup: ${makes.length} znaciek, ${models.length} modelov`);

  // Lowest id wins, which prefers the curated seed (id < 1 000 000) over anything
  // the scraper minted.
  // Lowest id wins here too, so the curated seed make beats an alias make.
  const canonicalMake = new Map<string, MakeRow>();
  for (const m of [...makes].sort((x, y) => x.id - y.id)) {
    const brand = resolveBrand(m.slug);
    if (brand && !canonicalMake.has(brand)) canonicalMake.set(brand, m);
  }

  const canonical = new Map<string, ModelRow>();
  for (const vm of [...models].sort((a, b) => a.id - b.id)) {
    const brand = resolveBrand(vm.make_slug);
    if (!brand) continue;
    const key = `${brand}::${bareSlug(brand, vm.make_slug, vm.slug)}`;
    if (!canonical.has(key)) canonical.set(key, vm);
  }

  const remap: Array<{ from: number; to: number }> = [];
  const move: Array<{ id: number; makeId: number; slug: string }> = [];
  const junk: number[] = [];
  for (const vm of models) {
    const brand = resolveBrand(vm.make_slug);
    if (!brand) {
      junk.push(vm.id); // predam / rozpredam / letne / hlinikove — not a brand
      continue;
    }
    const bare = bareSlug(brand, vm.make_slug, vm.slug);
    const target = canonical.get(`${brand}::${bare}`);
    if (target && target.id !== vm.id) {
      remap.push({ from: vm.id, to: target.id });
      continue;
    }
    // No twin to fold into, but the row itself sits under an alias make
    // ("mercedes-c" under make "mercedes"). Move the model rather than orphan
    // its listings — otherwise the alias make survives with cars still on it.
    const home = canonicalMake.get(brand);
    if (home && home.id !== vm.make_id) {
      move.push({ id: vm.id, makeId: home.id, slug: bare });
    }
  }
  log(`premapovat: ${remap.length}; presunut: ${move.length}; smetnych: ${junk.length}`);

  if (DRY) {
    log('--dry-run: nic sa nemeni');
    return;
  }

  let moved = 0;
  for (const r of remap) {
    const res = (await db.execute(
      sql`UPDATE listings SET model_id = ${r.to} WHERE model_id = ${r.from}`,
    )) as unknown as { rowCount?: number | null };
    moved += res.rowCount ?? 0;
  }
  log(`premapovanych inzeratov: ${moved}`);

  let movedModels = 0;
  for (const m of move) {
    try {
      await db.execute(
        sql`UPDATE vehicle_models SET make_id = ${m.makeId}, slug = ${m.slug} WHERE id = ${m.id}`,
      );
      movedModels++;
    } catch {
      // (make_id, slug) is unique; a collision means a twin appeared, so leave
      // the row for the next pass to fold instead of failing the whole run.
    }
  }
  log(`presunutych modelov pod spravnu znacku: ${movedModels}`);

  // Unclassified beats misclassified: a null model_id is a clean unknown, a junk
  // one silently poisons a cohort median. The null-model backfill retries these.
  let cleared = 0;
  for (let i = 0; i < junk.length; i += 500) {
    const chunk = junk.slice(i, i + 500);
    const res = (await db.execute(
      sql`UPDATE listings SET model_id = NULL WHERE model_id IN (${sql.join(
        chunk.map((id) => sql`${id}`),
        sql`, `,
      )})`,
    )) as unknown as { rowCount?: number | null };
    cleared += res.rowCount ?? 0;
  }
  log(`odpojenych od smetnych modelov: ${cleared}`);

  // Only scraper-minted rows are removable, and only once nothing references
  // them. Seeded rows (id < 1 000 000) are never touched.
  const delModels = (await db.execute(sql`
    DELETE FROM vehicle_models vm
    WHERE vm.id >= 1000000
      AND NOT EXISTS (SELECT 1 FROM listings l WHERE l.model_id = vm.id)
      AND NOT EXISTS (SELECT 1 FROM garage g WHERE g.model_id = vm.id)
      AND NOT EXISTS (SELECT 1 FROM watchlist w WHERE w.model_id = vm.id)
      AND NOT EXISTS (SELECT 1 FROM market_snapshots ms WHERE ms.model_id = vm.id)
  `)) as unknown as { rowCount?: number | null };
  const delMakes = (await db.execute(sql`
    DELETE FROM vehicle_makes m
    WHERE m.id >= 1000000
      AND NOT EXISTS (SELECT 1 FROM vehicle_models vm WHERE vm.make_id = m.id)
  `)) as unknown as { rowCount?: number | null };
  log(`zmazane: ${delModels.rowCount ?? 0} modelov, ${delMakes.rowCount ?? 0} znaciek`);

  const after = (await db.execute(sql`
    SELECT (SELECT count(*) FROM vehicle_makes) AS makes,
           (SELECT count(*) FROM vehicle_models) AS models,
           (SELECT count(*) FROM listings WHERE model_id IS NULL) AS bez_modelu
  `)) as unknown as Array<{ makes: number; models: number; bez_modelu: number }>;
  const a = after[0]!;
  log(`vysledok: ${a.makes} znaciek, ${a.models} modelov, ${a.bez_modelu} inzeratov bez modelu`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('[merge] ZLYHALO:', e instanceof Error ? e.message : e);
    process.exit(1);
  });
