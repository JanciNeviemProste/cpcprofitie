import * as Sentry from '@sentry/nextjs';
import { desc, eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { subscriptions, type Subscription } from '@/lib/db/schema';
import type { PlanId } from './plans';

// Returns the active subscription for a user, or null when missing / on free.
// Catches DB unavailability so call sites in dev (no DATABASE_URL) don't crash.
// A cancel + resubscribe leaves multiple rows per user (unique key is the
// Stripe subscription id), so prefer active/trialing rows, then the newest —
// without this a paying customer could be shown the stale canceled row.
export async function getUserSubscription(userId: string): Promise<Subscription | null> {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .orderBy(
        sql`CASE WHEN ${subscriptions.status} IN ('active', 'trialing') THEN 0 ELSE 1 END`,
        desc(subscriptions.updatedAt),
      )
      .limit(1);
    return rows[0] ?? null;
  } catch (e) {
    console.error('subscription_lookup_failed', e instanceof Error ? e.message : e);
    // Silent downgrade would mean paying users see free-tier limits. Alert.
    Sentry.captureException(e, {
      tags: { component: 'billing', step: 'getUserSubscription' },
      extra: { userId },
    });
    return null;
  }
}

export function effectivePlan(sub: Subscription | null): PlanId {
  if (!sub) return 'free';
  if (sub.status === 'active' || sub.status === 'trialing') return sub.plan;
  return 'free';
}
