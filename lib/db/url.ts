// Resolve the Postgres connection string. Accepts any of the three names
// commonly produced by Vercel-Supabase / Supabase / Drizzle setups so the
// project boots whether the env was wired manually or via the Vercel
// Marketplace integration.
//
//   DATABASE_URL                — manual / Drizzle-style
//   POSTGRES_URL_NON_POOLING    — Vercel-Supabase integration, direct
//                                 connection (required for migrations)
//   POSTGRES_URL                — Vercel-Supabase integration, pooled
//                                 (fine for runtime queries)
//
// For migrations (drizzle-kit push / generate) prefer the non-pooled URL;
// for runtime queries the pooled one is fine.

export function getDatabaseUrl(opts: { preferDirect?: boolean } = {}): string | null {
  const direct = process.env.POSTGRES_URL_NON_POOLING ?? null;
  const pooled = process.env.POSTGRES_URL ?? null;
  const manual = process.env.DATABASE_URL ?? null;
  if (opts.preferDirect) {
    return manual ?? direct ?? pooled ?? null;
  }
  return manual ?? pooled ?? direct ?? null;
}

export function hasDatabaseUrl(): boolean {
  return getDatabaseUrl() !== null;
}
