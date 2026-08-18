import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const captureException = vi.fn();
vi.mock('@sentry/nextjs', () => ({ captureException: (...a: unknown[]) => captureException(...a) }));

// Records every write the mirror attempts, and can be made to fail.
const state = { inserts: 0, fail: null as Error | null };

vi.mock('@/lib/db', () => ({
  getDb: () => ({
    insert: () => ({
      values: () => ({
        onConflictDoUpdate: () => {
          state.inserts++;
          return state.fail ? Promise.reject(state.fail) : Promise.resolve([]);
        },
      }),
    }),
  }),
}));

const authUser = { id: '11111111-1111-1111-1111-111111111111', email: 'jan@example.com' };
let currentUser: typeof authUser | null = authUser;

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: () => Promise.resolve({ data: { user: currentUser } }) },
  }),
}));
vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ getAll: () => [], set: () => {} }),
}));

import { __resetDbAvailability } from '@/lib/db/errors';
import { __resetUserSync, getCurrentUser } from '../server';

beforeEach(() => {
  process.env.DATABASE_URL = 'postgres://localhost/test';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
  state.inserts = 0;
  state.fail = null;
  currentUser = authUser;
  captureException.mockClear();
  __resetUserSync();
  __resetDbAvailability();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  delete process.env.DATABASE_URL;
  vi.restoreAllMocks();
});

describe('public.users mirroring', () => {
  it('creates the row on first sight of a session', async () => {
    await getCurrentUser();
    expect(state.inserts).toBe(1);
  });

  it('does not write again for the same user on every page render', async () => {
    await getCurrentUser();
    await getCurrentUser();
    await getCurrentUser();
    expect(state.inserts).toBe(1);
  });

  it('re-syncs when the email changes', async () => {
    await getCurrentUser();
    currentUser = { ...authUser, email: 'novy@example.com' };
    await getCurrentUser();
    expect(state.inserts).toBe(2);
  });

  it('still returns the session when the mirror write fails', async () => {
    // Auth must not break because a bookkeeping write failed — the session is
    // valid and most pages never touch the mirrored tables.
    state.fail = Object.assign(new Error('duplicate key'), { code: '23505' });
    await expect(getCurrentUser()).resolves.toMatchObject({ id: authUser.id });
    expect(captureException).toHaveBeenCalled();
  });

  it('reports an outage once instead of on every render, and stays usable', async () => {
    state.fail = Object.assign(new Error('(ENOTFOUND) tenant/user postgres.x not found'), {
      code: 'ENOTFOUND',
    });
    await expect(getCurrentUser()).resolves.toMatchObject({ id: authUser.id });
    await getCurrentUser();
    await getCurrentUser();
    expect(captureException).toHaveBeenCalledTimes(1);
  });

  it('is a no-op without a connection string, so dev without a database works', async () => {
    delete process.env.DATABASE_URL;
    await expect(getCurrentUser()).resolves.toMatchObject({ id: authUser.id });
    expect(state.inserts).toBe(0);
  });
});
