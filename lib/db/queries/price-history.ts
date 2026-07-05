// Read-side helper for the per-listing price history chart on
// `/app/listings/[id]`. Daily rows are inserted by the
// `daily-price-snapshot` cron.

import * as Sentry from '@sentry/nextjs';
import { asc, eq } from 'drizzle-orm';
import { getDb } from '../index';
import { listingPriceHistory } from '../schema';

export async function getPriceHistory(
  listingId: bigint,
): Promise<Array<{ date: Date; price: number }>> {
  try {
    return await getPriceHistoryUnsafe(listingId);
  } catch (e) {
    // Graceful-empty — the chart section hides itself when there's no data.
    Sentry.captureException(e, { tags: { component: 'price-history', step: 'getPriceHistory' } });
    return [];
  }
}

async function getPriceHistoryUnsafe(
  listingId: bigint,
): Promise<Array<{ date: Date; price: number }>> {
  const db = getDb();
  const rows = await db
    .select({
      recordedOn: listingPriceHistory.recordedOn,
      priceEur: listingPriceHistory.priceEur,
    })
    .from(listingPriceHistory)
    .where(eq(listingPriceHistory.listingId, listingId))
    .orderBy(asc(listingPriceHistory.recordedOn));

  return rows.map((r) => ({
    date: new Date(r.recordedOn as unknown as string),
    price: Number(r.priceEur),
  }));
}
