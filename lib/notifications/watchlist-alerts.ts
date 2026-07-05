// Watchlist alert engine. For every watchlist entry with e-mail alerts on,
// finds listings first seen since the last notification that match the
// entry's criteria, groups matches per user, and sends one e-mail per user.
// Driven by /api/cron/watchlist-alerts (daily).

import * as Sentry from '@sentry/nextjs';
import { render } from '@react-email/components';
import { and, asc, eq, gte, lte, sql } from 'drizzle-orm';
import {
  WatchlistAlertEmail,
  alertSubject,
  buildAlertGroups,
  type AlertListing,
} from '@/emails/watchlist-alert';
import { getAppUrl } from '@/lib/app-url';
import { krajByName } from '@/lib/data/sk-regions';
import { getDb } from '@/lib/db';
import { events, listings, users, vehicleMakes, vehicleModels, watchlist } from '@/lib/db/schema';
import { sendEmailBatch, isEmailLive } from '@/lib/email/send';

export type AlertStats = {
  watchlistsScanned: number;
  watchlistsMatched: number;
  usersEmailed: number;
  usersSkippedBackstop: number;
  listingsMatched: number;
  errors: number;
  mode: 'live' | 'mock' | 'dry-run' | 'disabled';
};

// Cap matches loaded per watchlist; the e-mail shows 10 and reports the rest
// as "+X ďalších". Days with >100 matches for one watchlist lose the tail —
// at that volume the entry is effectively a firehose, not an alert.
const MATCH_LIMIT_PER_WATCHLIST = 100;
// Events-table backstop: skip a user alerted less than this many hours ago
// even if lastNotifiedAt failed to persist.
const BACKSTOP_HOURS = 20;
// Resend allows ~2 req/s; we send one batch call per user, so pace the loop.
const INTER_USER_DELAY_MS = 600;

const PROD = process.env.VERCEL_ENV === 'production';

type WatchRow = {
  id: string;
  userId: string;
  email: string;
  modelId: number | null;
  modelName: string;
  region: string | null;
  minPriceEur: number | null;
  maxPriceEur: number | null;
  minYear: number | null;
  maxMileageKm: number | null;
  fuel: string | null;
  since: Date | string;
};

export async function runWatchlistAlerts(
  opts: { dryRun?: boolean; maxWatchlists?: number } = {},
): Promise<AlertStats> {
  const dryRun = opts.dryRun ?? false;
  const maxWatchlists = Math.min(2000, Math.max(1, opts.maxWatchlists ?? 500));
  const db = getDb();
  const live = isEmailLive();
  const stats: AlertStats = {
    watchlistsScanned: 0,
    watchlistsMatched: 0,
    usersEmailed: 0,
    usersSkippedBackstop: 0,
    listingsMatched: 0,
    errors: 0,
    mode: dryRun ? 'dry-run' : live ? 'live' : PROD ? 'disabled' : 'mock',
  };

  // The window END is captured once, before matching. lastNotifiedAt is later
  // set to exactly this value — listings ingested while the run is in flight
  // fall into the NEXT window instead of a permanent blind spot.
  const windowEnd = new Date();

  // Inner join users: entries whose owner has no users row (Supabase trigger
  // not yet fired) are silently skipped — nowhere to send. Entries orphaned
  // by a vehicle_models delete (modelId NULL via ON DELETE SET NULL) are
  // excluded too: without the model filter they'd degrade into
  // match-everything firehoses. Ordered so a >maxWatchlists table degrades
  // deterministically instead of starving a random subset.
  const watchRows = (await db
    .select({
      id: watchlist.id,
      userId: watchlist.userId,
      email: users.email,
      modelId: watchlist.modelId,
      modelName: sql<string>`COALESCE(${vehicleMakes.name} || ' ' || ${vehicleModels.name}, 'Model')`,
      region: watchlist.region,
      minPriceEur: sql<number | null>`${watchlist.minPriceEur}::float8`,
      maxPriceEur: sql<number | null>`${watchlist.maxPriceEur}::float8`,
      minYear: watchlist.minYear,
      maxMileageKm: watchlist.maxMileageKm,
      fuel: watchlist.fuel,
      // Clamped to 7 days back so an outage can't flood inboxes on recovery.
      since: sql<Date>`GREATEST(COALESCE(${watchlist.lastNotifiedAt}, ${watchlist.createdAt}), now() - interval '7 days')`,
    })
    .from(watchlist)
    .innerJoin(users, eq(users.id, watchlist.userId))
    .leftJoin(vehicleModels, eq(vehicleModels.id, watchlist.modelId))
    .leftJoin(vehicleMakes, eq(vehicleMakes.id, vehicleModels.makeId))
    .where(and(eq(watchlist.notifyByEmail, true), sql`${watchlist.modelId} IS NOT NULL`))
    .orderBy(asc(watchlist.createdAt))
    .limit(maxWatchlists)) as WatchRow[];

  stats.watchlistsScanned = watchRows.length;
  if (watchRows.length === 0) return stats;

  // Match listings per watchlist. One query per row is simple and fine at
  // current scale (hundreds of rows, indexed on (model_id, first_seen_at)).
  type UserBucket = {
    email: string;
    groups: { watchLabel: string; listings: AlertListing[] }[];
    watchlistIds: string[];
  };
  const byUser = new Map<string, UserBucket>();

  for (const w of watchRows) {
    try {
      const conditions = [
        sql`${listings.canonicalListingId} IS NULL`,
        sql`${listings.soldAt} IS NULL`,
        sql`${listings.removedAt} IS NULL`,
        gte(listings.firstSeenAt, new Date(w.since)),
        lte(listings.firstSeenAt, windowEnd),
        eq(listings.modelId, w.modelId!),
      ];
      if (w.minPriceEur != null) conditions.push(sql`${listings.priceEur} >= ${w.minPriceEur}`);
      if (w.maxPriceEur != null) conditions.push(sql`${listings.priceEur} <= ${w.maxPriceEur}`);
      if (w.minYear != null) conditions.push(sql`${listings.year} >= ${w.minYear}`);
      if (w.maxMileageKm != null)
        conditions.push(sql`${listings.mileageKm} <= ${w.maxMileageKm}`);
      if (w.fuel) conditions.push(sql`${listings.fuel} = ${w.fuel}`);
      if (w.region) {
        const kraj = krajByName(w.region);
        if (kraj) {
          conditions.push(
            sql`(${sql.join(
              kraj.patterns.map((p) => sql`${listings.region} ILIKE ${p}`),
              sql` OR `,
            )})`,
          );
        }
      }

      const matches = await db
        .select({
          rawTitle: listings.rawTitle,
          priceEur: sql<number | null>`${listings.priceEur}::float8`,
          year: listings.year,
          mileageKm: listings.mileageKm,
          url: listings.url,
        })
        .from(listings)
        .where(and(...conditions))
        .orderBy(sql`${listings.firstSeenAt} DESC`)
        .limit(MATCH_LIMIT_PER_WATCHLIST);

      if (matches.length === 0) continue;

      stats.watchlistsMatched++;
      stats.listingsMatched += matches.length;

      const bucket = byUser.get(w.userId) ?? { email: w.email, groups: [], watchlistIds: [] };
      bucket.groups.push({
        watchLabel: buildWatchLabel(w),
        listings: matches.map((m) => ({
          title: m.rawTitle ?? w.modelName,
          priceEur: m.priceEur != null ? Math.round(m.priceEur) : null,
          year: m.year,
          mileageKm: m.mileageKm,
          url: m.url,
        })),
      });
      bucket.watchlistIds.push(w.id);
      byUser.set(w.userId, bucket);
    } catch (e) {
      stats.errors++;
      Sentry.captureException(e, {
        tags: { component: 'watchlist-alerts', step: 'match' },
        extra: { watchlistId: w.id },
      });
    }
  }

  if (byUser.size === 0 || dryRun) return stats;

  // Prod without RESEND_API_KEY: report the matches but consume nothing —
  // a mock-mode bump here would silently eat alerts until someone noticed
  // the key was gone. Dev/preview mock keeps bumping so a key-less env
  // doesn't re-report the same matches forever.
  if (PROD && !live) {
    Sentry.captureMessage('watchlist_alerts_disabled_no_resend_key', {
      level: 'warning',
      extra: { usersWithMatches: byUser.size },
    });
    return stats;
  }

  // Backstop: skip users who already got an alert within the last 20h even
  // if lastNotifiedAt failed to persist (belt and braces vs double-send).
  const recentlyAlerted = new Set<string>(
    (
      await db
        .select({ userId: events.userId })
        .from(events)
        .where(
          and(
            eq(events.type, 'watchlist_alert_sent'),
            sql`${events.createdAt} > now() - interval '${sql.raw(String(BACKSTOP_HOURS))} hours'`,
          ),
        )
    )
      .map((r) => r.userId)
      .filter((id): id is string => id != null),
  );

  let firstSend = true;
  for (const [userId, bucket] of byUser) {
    if (recentlyAlerted.has(userId)) {
      stats.usersSkippedBackstop++;
      continue;
    }
    try {
      // One Resend call per user (needed for per-user bookkeeping) — pace
      // the loop so N users don't blow the ~2 req/s API limit. Bounded by
      // the 300s cron budget at roughly ~450 users/run.
      if (!firstSend && stats.mode === 'live') {
        await new Promise((r) => setTimeout(r, INTER_USER_DELAY_MS));
      }
      firstSend = false;

      const groups = buildAlertGroups(bucket.groups);
      const total = bucket.groups.reduce((s, g) => s + g.listings.length, 0);
      const html = await render(WatchlistAlertEmail({ groups, appUrl: getAppUrl() }));
      const result = await sendEmailBatch([
        { to: bucket.email, subject: alertSubject(total), html },
      ]);
      if (result.errors > 0) {
        stats.errors++;
        continue; // don't bump lastNotifiedAt — retry next run
      }

      // Bump lastNotifiedAt to the window END captured before matching (not
      // now()) and log the event. Mock mode (non-prod only, see guard above)
      // also bumps so local runs don't re-report forever.
      await db
        .update(watchlist)
        .set({ lastNotifiedAt: windowEnd })
        .where(
          sql`${watchlist.id} IN (${sql.join(
            bucket.watchlistIds.map((id) => sql`${id}::uuid`),
            sql`, `,
          )})`,
        );
      await db.insert(events).values({
        userId,
        type: 'watchlist_alert_sent',
        payload: { watchlistIds: bucket.watchlistIds, listingCount: total, mode: result.mode },
      });
      if (result.mode === 'live') stats.usersEmailed++;
    } catch (e) {
      stats.errors++;
      Sentry.captureException(e, {
        tags: { component: 'watchlist-alerts', step: 'send' },
        extra: { userId },
      });
    }
  }

  return stats;
}

function buildWatchLabel(w: {
  modelName: string;
  region: string | null;
  maxPriceEur: number | null;
  minYear: number | null;
}): string {
  const parts = [w.modelName];
  if (w.region) parts.push(`${w.region} kraj`);
  if (w.maxPriceEur != null) parts.push(`do ${Math.round(w.maxPriceEur).toLocaleString('sk-SK')} €`);
  if (w.minYear != null) parts.push(`od r. ${w.minYear}`);
  return parts.join(' · ');
}
