import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getDatabaseUrl } from './url';

let cached: ReturnType<typeof drizzle> | undefined;

export function getDb() {
  if (cached) return cached;
  const url = getDatabaseUrl();
  if (!url) {
    throw new Error(
      'No Postgres connection string. Set DATABASE_URL or POSTGRES_URL / POSTGRES_URL_NON_POOLING (Vercel-Supabase integration).',
    );
  }
  const client = postgres(url, { prepare: false });
  cached = drizzle(client);
  return cached;
}
