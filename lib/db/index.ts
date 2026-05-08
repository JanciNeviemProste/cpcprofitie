import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

let cached: ReturnType<typeof drizzle> | undefined;

export function getDb() {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }
  const client = postgres(url, { prepare: false });
  cached = drizzle(client);
  return cached;
}
