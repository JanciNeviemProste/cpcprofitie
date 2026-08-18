// Connection-failure classification for the Postgres layer.
//
// Why this exists: every catch block in the codebase used to treat "Postgres is
// unreachable" exactly like "this row violates a FK". That made a single outage
// look like thousands of independent bugs — CPCPROFIT-8 logged 10 998 events
// over 13 days because one deleted Supabase project meant every `ensureModelId`
// call in every batch of every cron run failed and reported separately.
//
// Two pieces solve that:
//   isConnectionError()  — tells an outage apart from a query-level error
//   noteDbUnavailable()  — reports the outage to Sentry EXACTLY ONCE per run
//                          and hands back a typed error that aborts the run
//
// Anything a retry can't fix and a row-level fix can't fix belongs here.

import * as Sentry from '@sentry/nextjs';

/**
 * Thrown when Postgres itself is unreachable, as opposed to a specific query
 * failing. Callers should let this propagate: once the server is down, the
 * remaining N iterations of whatever loop we're in cannot possibly succeed.
 */
export class DbUnavailableError extends Error {
  constructor(cause: unknown) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    super(`Database unavailable: ${detail}`);
    this.name = 'DbUnavailableError';
    this.cause = cause;
  }
}

// Node/libuv socket + DNS failures. ENOTFOUND is the one that bit us: a deleted
// Supabase project stops resolving on *.supabase.co entirely.
const SOCKET_CODES = new Set([
  'ENOTFOUND',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'EPIPE',
  'EHOSTUNREACH',
  'ENETUNREACH',
]);

// postgres.js surfaces its own lifecycle failures under these codes.
const POSTGRES_JS_CODES = new Set([
  'CONNECTION_ENDED',
  'CONNECTION_DESTROYED',
  'CONNECTION_CLOSED',
  'CONNECTION_CONNECT_TIMEOUT',
  'CONNECT_TIMEOUT',
]);

// SQLSTATEs that mean "the server is going away / can't take you right now".
// Deliberately NOT included: 23503 (FK), 23505 (unique), 42703 (undefined
// column) and friends — those are real, actionable, per-row bugs and must keep
// their current per-occurrence reporting.
const SQLSTATE_CODES = new Set([
  '57P01', // admin_shutdown
  '57P02', // crash_shutdown
  '57P03', // cannot_connect_now
  '53300', // too_many_connections
  '08000', // connection_exception
  '08001', // sqlclient_unable_to_establish_sqlconnection
  '08003', // connection_does_not_exist
  '08006', // connection_failure
]);

// Supavisor (Supabase's pooler) rejects an unknown project ref with a generic
// XX000 SQLSTATE, so the code alone can't identify it — the message is the only
// signal. This is the literal shape seen in CPCPROFIT-8:
//   (ENOTFOUND) tenant/user postgres.nwmgungvcyemsatduxto not found
const MESSAGE_PATTERNS = [
  /tenant or user not found/i,
  /tenant\/user .* not found/i,
  /connection terminated/i,
  /connection refused/i,
  /getaddrinfo/i,
  /server closed the connection unexpectedly/i,
];

function codeOf(e: unknown): string | null {
  if (typeof e !== 'object' || e === null) return null;
  const rec = e as { code?: unknown; errno?: unknown };
  if (typeof rec.code === 'string') return rec.code;
  if (typeof rec.errno === 'string') return rec.errno;
  return null;
}

/**
 * Walks the whole `cause` chain. Drizzle wraps the driver error in its own
 * `DrizzleQueryError` ("Failed query: select ..."), so the outermost layer
 * always looks like a query error even during a total outage — the real signal
 * is nested one or two levels down.
 */
export function isConnectionError(e: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = e;

  // Bounded so a self-referencing cause can't spin forever.
  for (let depth = 0; depth < 10 && current != null; depth++) {
    if (seen.has(current)) break;
    seen.add(current);

    if (current instanceof DbUnavailableError) return true;

    const code = codeOf(current);
    if (
      code &&
      (SOCKET_CODES.has(code) || POSTGRES_JS_CODES.has(code) || SQLSTATE_CODES.has(code))
    ) {
      return true;
    }

    const message = current instanceof Error ? current.message : null;
    if (message && MESSAGE_PATTERNS.some((re) => re.test(message))) return true;

    current = (current as { cause?: unknown }).cause;
  }

  return false;
}

// Suppresses duplicate reports for a short window rather than forever.
//
// A per-process 'reported once' latch looked right but was wrong: Vercel reuses
// a warm instance across many invocations, and cron routes are exactly the
// workload that keeps one warm. A permanent latch means run 2 of a multi-day
// outage reports nothing, and a second unrelated outage hours later is dropped
// silently. The cooldown collapses the 480-per-run storm (its actual job) while
// still re-reporting each run. Sentry's fixed fingerprint keeps them one issue.
const REPORT_COOLDOWN_MS = 5 * 60_000;
let reportedAt = 0;

/** Test seam — mirrors `__resetModelCache()` in lib/scraping/persist.ts. */
export function __resetDbAvailability(): void {
  reportedAt = 0;
}

/**
 * Records an outage and returns the error to throw.
 *
 * Deliberately NOT paired with an `isDbKnownUnavailable()` global that
 * loops can consult: a process-wide 'database is down' flag survives the outage and turns
 * later healthy runs into silent no-ops. Callers scope that decision to their
 * own run instead — see resolveModelIds in lib/scraping/persist.ts.
 */
export function noteDbUnavailable(
  cause: unknown,
  context: Record<string, unknown> = {},
): DbUnavailableError {
  if (cause instanceof DbUnavailableError) return cause;
  const wrapped = new DbUnavailableError(cause);

  const now = Date.now();
  if (now - reportedAt > REPORT_COOLDOWN_MS) {
    reportedAt = now;
    console.error('db_unavailable', {
      ...context,
      error: cause instanceof Error ? cause.message : String(cause),
    });
    Sentry.captureException(cause, {
      level: 'fatal',
      // Collapse every outage into one issue regardless of which query tripped
      // it — without this, each distinct SQL string opens its own Sentry issue.
      fingerprint: ['db-unavailable'],
      tags: { component: 'db', step: 'connection' },
      extra: context,
    });
  }

  return wrapped;
}

/**
 * Wraps a database call so an outage is classified at the point it happens.
 *
 * Use this when the surrounding try/catch also covers network I/O (an HTTP
 * fetch, an email send). Socket codes like ETIMEDOUT and ECONNRESET are
 * indistinguishable between "Postgres died" and "the remote site was slow", so
 * a broad `isConnectionError(e)` check there would abort a healthy run the
 * first time a listing page timed out. Wrapping only the DB statement means the
 * outer catch can safely test for `DbUnavailableError` instead.
 */
export async function dbCall<T>(
  fn: () => Promise<T>,
  context: Record<string, unknown> = {},
): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (isConnectionError(e)) throw noteDbUnavailable(e, context);
    throw e;
  }
}
