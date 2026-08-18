import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const captureException = vi.fn();
vi.mock('@sentry/nextjs', () => ({ captureException: (...a: unknown[]) => captureException(...a) }));

import {
  DbUnavailableError,
  __resetDbAvailability,
  dbCall,
  isConnectionError,
  isDbKnownUnavailable,
  noteDbUnavailable,
} from '../errors';

/** Drizzle wraps the driver error, so the real signal is always nested. */
function drizzleWrapped(cause: unknown): Error {
  const e = new Error('Failed query: select "id" from "vehicle_models" where "slug" = $1 limit $2');
  (e as { cause?: unknown }).cause = cause;
  return e;
}

function withCode(message: string, code: string): Error {
  return Object.assign(new Error(message), { code });
}

beforeEach(() => {
  captureException.mockClear();
  __resetDbAvailability();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('isConnectionError — outages', () => {
  it('detects the exact CPCPROFIT-8 shape (Supavisor tenant rejection, nested)', () => {
    const supavisor = withCode('(ENOTFOUND) tenant/user postgres.nwmgungvcyemsatduxto not found', 'XX000');
    expect(isConnectionError(drizzleWrapped(supavisor))).toBe(true);
  });

  it('detects it by message alone when the code is unhelpful', () => {
    expect(isConnectionError(new Error('Tenant or user not found'))).toBe(true);
  });

  it.each([
    'ENOTFOUND',
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'EAI_AGAIN',
    'CONNECTION_ENDED',
    'CONNECTION_CONNECT_TIMEOUT',
    '57P01',
    '53300',
    '08006',
  ])('detects %s', (code) => {
    expect(isConnectionError(withCode('down', code))).toBe(true);
  });

  it('unwraps two levels of nesting', () => {
    expect(isConnectionError(drizzleWrapped(drizzleWrapped(withCode('x', 'ENOTFOUND'))))).toBe(true);
  });

  it('recognises an already-classified DbUnavailableError', () => {
    expect(isConnectionError(new DbUnavailableError(new Error('x')))).toBe(true);
  });
});

describe('isConnectionError — NOT outages', () => {
  // These must keep their existing per-occurrence reporting: they are real,
  // actionable, row-level bugs that a run should survive.
  it.each([
    ['23503', 'foreign key violation'],
    ['23505', 'duplicate key value violates unique constraint'],
    ['42703', 'column "foo" does not exist'],
    ['42P01', 'relation "listings" does not exist'],
    ['22P02', 'invalid input syntax for type integer'],
  ])('treats SQLSTATE %s as a query error', (code, message) => {
    expect(isConnectionError(drizzleWrapped(withCode(message, code)))).toBe(false);
  });

  it('does not classify a plain error, null, or a string', () => {
    expect(isConnectionError(new Error('something broke'))).toBe(false);
    expect(isConnectionError(null)).toBe(false);
    expect(isConnectionError('ENOTFOUND')).toBe(false);
  });

  it('survives a self-referencing cause chain', () => {
    const e = new Error('loop') as Error & { cause?: unknown };
    e.cause = e;
    expect(isConnectionError(e)).toBe(false);
  });
});

describe('noteDbUnavailable — one report per run', () => {
  it('reports the first failure only, however many follow', () => {
    const err = withCode('boom', 'ENOTFOUND');
    for (let i = 0; i < 480; i++) noteDbUnavailable(err, { i });
    expect(captureException).toHaveBeenCalledTimes(1);
  });

  it('groups every outage into one Sentry issue', () => {
    noteDbUnavailable(withCode('boom', 'ENOTFOUND'), {});
    expect(captureException.mock.calls[0]![1]).toMatchObject({
      level: 'fatal',
      fingerprint: ['db-unavailable'],
      tags: { component: 'db', step: 'connection' },
    });
  });

  it('flips isDbKnownUnavailable so loops can bail early', () => {
    expect(isDbKnownUnavailable()).toBe(false);
    noteDbUnavailable(withCode('boom', 'ENOTFOUND'), {});
    expect(isDbKnownUnavailable()).toBe(true);
  });

  it('returns a DbUnavailableError carrying the original cause', () => {
    const cause = withCode('boom', 'ENOTFOUND');
    const wrapped = noteDbUnavailable(cause, {});
    expect(wrapped).toBeInstanceOf(DbUnavailableError);
    expect(wrapped.cause).toBe(cause);
  });

  it('does not double-wrap', () => {
    const first = noteDbUnavailable(withCode('boom', 'ENOTFOUND'), {});
    expect(noteDbUnavailable(first, {})).toBe(first);
  });
});

describe('dbCall', () => {
  it('passes the value through when the call succeeds', async () => {
    await expect(dbCall(() => Promise.resolve(42))).resolves.toBe(42);
    expect(captureException).not.toHaveBeenCalled();
  });

  it('converts an outage into DbUnavailableError', async () => {
    await expect(dbCall(() => Promise.reject(withCode('boom', 'ENOTFOUND')))).rejects.toBeInstanceOf(
      DbUnavailableError,
    );
  });

  it('rethrows a query error untouched, so callers can keep handling it per-row', async () => {
    const fk = withCode('fk violation', '23503');
    await expect(dbCall(() => Promise.reject(fk))).rejects.toBe(fk);
    expect(captureException).not.toHaveBeenCalled();
  });
});
