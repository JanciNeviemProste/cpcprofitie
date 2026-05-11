import type { Config } from 'drizzle-kit';
import { getDatabaseUrl } from './lib/db/url';

// Migrations require a direct (non-pooled) connection; Vercel-Supabase exposes
// POSTGRES_URL_NON_POOLING for this. Fall back to DATABASE_URL for projects
// that wire the connection manually.
export default {
  schema: './lib/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: getDatabaseUrl({ preferDirect: true }) ?? '',
  },
  strict: true,
  verbose: true,
} satisfies Config;
