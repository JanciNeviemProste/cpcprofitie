// Prints one number: listings with no listing_details row. Used by the overnight
// orchestrator to decide whether another enrichment round is worth running.
import { config as loadEnv } from 'dotenv';
import { sql } from 'drizzle-orm';
import { getDb } from '../lib/db';
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

async function main() {
  const rows = (await getDb().execute(sql`
    SELECT count(*)::int AS n FROM listings l
    LEFT JOIN listing_details d ON d.listing_id = l.id
    WHERE d.listing_id IS NULL
  `)) as unknown as Array<{ n: number }>;
  console.log(rows[0]?.n ?? 0);
}
main().then(() => process.exit(0)).catch(() => { console.log('ERR'); process.exit(1); });
