// Weekly market digest. Recipients = users owning at least one watchlist
// entry with e-mail alerts on (no global preference exists yet — the
// per-entry toggle is the opt-out). Content is global in v1: top models by
// demand with WoW movement. Driven by /api/cron/weekly-digest (Mon 07:00).

import * as Sentry from '@sentry/nextjs';
import { render } from '@react-email/components';
import { and, eq, sql } from 'drizzle-orm';
import { DIGEST_SUBJECT, WeeklyDigestEmail } from '@/emails/weekly-digest';
import { getAppUrl } from '@/lib/app-url';
import { getDb } from '@/lib/db';
import { events, users, watchlist } from '@/lib/db/schema';
import { getTrendingModels } from '@/lib/db/queries/trends';
import { sendEmailBatch, isEmailLive } from '@/lib/email/send';

export type DigestStats = {
  recipients: number;
  sent: number;
  skippedBackstop: number;
  errors: number;
  mode: 'live' | 'mock' | 'dry-run' | 'disabled';
};

// Skip users who got a digest within the last 6 days — makes a re-run of the
// Monday cron (or a manual trigger) idempotent.
const BACKSTOP_DAYS = 6;

const PROD = process.env.VERCEL_ENV === 'production';

export async function runWeeklyDigest(opts: { dryRun?: boolean } = {}): Promise<DigestStats> {
  const dryRun = opts.dryRun ?? false;
  const db = getDb();
  const live = isEmailLive();
  const stats: DigestStats = {
    recipients: 0,
    sent: 0,
    skippedBackstop: 0,
    errors: 0,
    mode: dryRun ? 'dry-run' : live ? 'live' : PROD ? 'disabled' : 'mock',
  };

  const recipients = await db
    .selectDistinct({ userId: users.id, email: users.email })
    .from(watchlist)
    .innerJoin(users, eq(users.id, watchlist.userId))
    .where(eq(watchlist.notifyByEmail, true));

  stats.recipients = recipients.length;
  if (recipients.length === 0 || dryRun) return stats;

  // Prod without RESEND_API_KEY: report the recipient count but send and
  // record nothing — recording events here would mask the missing key.
  if (PROD && !live) {
    Sentry.captureMessage('weekly_digest_disabled_no_resend_key', {
      level: 'warning',
      extra: { recipients: recipients.length },
    });
    return stats;
  }

  const recentlySent = new Set<string>(
    (
      await db
        .select({ userId: events.userId })
        .from(events)
        .where(
          and(
            eq(events.type, 'weekly_digest_sent'),
            sql`${events.createdAt} > now() - interval '${sql.raw(String(BACKSTOP_DAYS))} days'`,
          ),
        )
    )
      .map((r) => r.userId)
      .filter((id): id is string => id != null),
  );

  const trends = await getTrendingModels({ limit: 5, sort: 'demand' });
  const html = await render(WeeklyDigestEmail({ trends, appUrl: getAppUrl() }));

  const toSend = recipients.filter((r) => {
    if (recentlySent.has(r.userId)) {
      stats.skippedBackstop++;
      return false;
    }
    return true;
  });

  const result = await sendEmailBatch(
    toSend.map((r) => ({ to: r.email, subject: DIGEST_SUBJECT, html })),
  );
  stats.errors += result.errors;
  stats.sent = result.sent;

  // Record events per recipient that actually went out (successful chunks
  // only, via result.sentTo) — a partial chunk failure then retries just the
  // failed remainder instead of double-sending to everyone. In non-prod mock
  // mode nothing is delivered but everything is recorded, so a key-less env
  // doesn't "resend" on every manual run.
  const delivered =
    result.mode === 'mock' ? toSend : toSend.filter((r) => result.sentTo.includes(r.email));
  if (delivered.length > 0) {
    try {
      await db.insert(events).values(
        delivered.map((r) => ({
          userId: r.userId,
          type: 'weekly_digest_sent',
          payload: { mode: result.mode },
        })),
      );
    } catch (e) {
      Sentry.captureException(e, {
        tags: { component: 'weekly-digest', step: 'recordEvents' },
      });
    }
  }

  return stats;
}
