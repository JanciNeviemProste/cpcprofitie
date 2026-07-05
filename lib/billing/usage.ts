import * as Sentry from '@sentry/nextjs';
import { and, count, eq, gte } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { aiListings, garage, watchlist } from '@/lib/db/schema';

// Real usage counters backing lib/billing/quota.ts checks and the billing
// page. Counting failures degrade to 0 (fail-open) with a Sentry alert —
// a DB outage must not brick the AI form, and the insert path will surface
// the same incident anyway.

export function currentMonthStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function countAiListingsThisMonth(userId: string): Promise<number> {
  try {
    const db = getDb();
    const rows = await db
      .select({ n: count() })
      .from(aiListings)
      .where(and(eq(aiListings.userId, userId), gte(aiListings.createdAt, currentMonthStart())));
    return rows[0]?.n ?? 0;
  } catch (e) {
    Sentry.captureException(e, {
      tags: { component: 'billing', step: 'countAiListingsThisMonth' },
      extra: { userId },
    });
    return 0;
  }
}

export type UsageSummary = {
  aiListingsThisMonth: number;
  watchlistCount: number;
  garageCount: number;
};

export async function getUsageSummary(userId: string): Promise<UsageSummary> {
  try {
    const db = getDb();
    const [ai, wl, ga] = await Promise.all([
      db
        .select({ n: count() })
        .from(aiListings)
        .where(and(eq(aiListings.userId, userId), gte(aiListings.createdAt, currentMonthStart()))),
      db.select({ n: count() }).from(watchlist).where(eq(watchlist.userId, userId)),
      db.select({ n: count() }).from(garage).where(eq(garage.userId, userId)),
    ]);
    return {
      aiListingsThisMonth: ai[0]?.n ?? 0,
      watchlistCount: wl[0]?.n ?? 0,
      garageCount: ga[0]?.n ?? 0,
    };
  } catch (e) {
    Sentry.captureException(e, {
      tags: { component: 'billing', step: 'getUsageSummary' },
      extra: { userId },
    });
    return { aiListingsThisMonth: 0, watchlistCount: 0, garageCount: 0 };
  }
}

export type RecordAiListingInput = {
  userId: string;
  input: unknown;
  generatedTitle?: string | null;
  generatedBody?: string | null;
  modelUsed?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
};

// Called from the stream's onFinish — the response is already delivered, so
// never throw; a lost usage row is a Sentry alert, not a user-facing error.
export async function recordAiListing(entry: RecordAiListingInput): Promise<void> {
  try {
    const db = getDb();
    await db.insert(aiListings).values({
      userId: entry.userId,
      inputJson: entry.input,
      generatedTitle: entry.generatedTitle ?? null,
      generatedBody: entry.generatedBody ?? null,
      modelUsed: entry.modelUsed ?? null,
      promptTokens: entry.promptTokens ?? null,
      completionTokens: entry.completionTokens ?? null,
    });
  } catch (e) {
    Sentry.captureException(e, {
      tags: { component: 'billing', step: 'recordAiListing' },
      extra: { userId: entry.userId },
    });
  }
}
