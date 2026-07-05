import * as Sentry from '@sentry/nextjs';
import { desc } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { scrapeRuns } from '@/lib/db/schema';

export type ScrapeRunRow = {
  id: number;
  source: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  startedAt: Date;
  finishedAt: Date | null;
  listingsAdded: number;
  listingsUpdated: number;
  errorMessage: string | null;
};

export type ScrapeRunSummary = {
  succeeded24h: number;
  failed24h: number;
  totalAdded: number;
};

// Computed outside the React component — Date.now() is impure during render.
export function summarizeRuns(runs: ScrapeRunRow[]): ScrapeRunSummary {
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  return {
    succeeded24h: runs.filter(
      (r) => r.status === 'succeeded' && r.startedAt.getTime() >= dayAgo,
    ).length,
    failed24h: runs.filter((r) => r.status === 'failed' && r.startedAt.getTime() >= dayAgo)
      .length,
    totalAdded: runs.reduce((s, r) => s + r.listingsAdded, 0),
  };
}

// Graceful-empty on DB unavailability, matching the other query modules.
export async function getRecentScrapeRuns(limit = 30): Promise<ScrapeRunRow[]> {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(scrapeRuns)
      .orderBy(desc(scrapeRuns.startedAt))
      .limit(limit);
    return rows.map((r) => ({
      id: Number(r.id),
      source: r.source,
      status: r.status,
      startedAt: r.startedAt,
      finishedAt: r.finishedAt,
      listingsAdded: r.listingsAdded,
      listingsUpdated: r.listingsUpdated,
      errorMessage: r.errorMessage,
    }));
  } catch (e) {
    Sentry.captureException(e, { tags: { component: 'admin', step: 'getRecentScrapeRuns' } });
    return [];
  }
}
