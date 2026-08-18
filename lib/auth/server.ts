import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import * as Sentry from '@sentry/nextjs';
import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { isConnectionError, noteDbUnavailable } from '@/lib/db/errors';
import { hasDatabaseUrl } from '@/lib/db/url';
import { users } from '@/lib/db/schema';

export async function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from Server Component — middleware refreshes the session.
        }
      },
    },
  });
}

// Supabase Auth owns auth.users, but the app's own tables key off public.users
// and nothing else writes to it — there is no FK to auth.users and no
// on_auth_user_created trigger. On an existing database the rows were already
// there so this went unnoticed; on a fresh one a signup lands in auth.users
// only, and every FK'd table (subscriptions, garage, watchlist, ai_listings,
// events) rejects writes for that user. Mirroring here covers both signup and
// existing sessions, and lives in the repo where drizzle-kit push can see it.

// Which users this process has already mirrored. Keyed on id+email so an email
// change re-syncs. Resets with the lambda, costing one redundant upsert per
// cold start.
const syncedUsers = new Set<string>();

/** Test seam. */
export function __resetUserSync(): void {
  syncedUsers.clear();
}

async function syncUserRow(user: {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!user.email || !hasDatabaseUrl()) return;
  const key = `${user.id}:${user.email}`;
  if (syncedUsers.has(key)) return;

  const rawName = user.user_metadata?.full_name;
  const fullName = typeof rawName === 'string' && rawName.length > 0 ? rawName : null;

  try {
    await getDb()
      .insert(users)
      .values({ id: user.id, email: user.email, fullName })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: sql`excluded.email`,
          // Never clobber a stored name with a null from a provider that
          // doesn't supply one. `role` is deliberately untouched — admin is
          // decided by ADMIN_EMAILS (lib/auth/admin.ts), not by this column.
          fullName: sql`coalesce(excluded.full_name, ${users.fullName})`,
          updatedAt: sql`now()`,
        },
      });
    syncedUsers.add(key);
  } catch (e) {
    // A failed mirror must not lock the user out: the session is valid and most
    // pages don't touch these tables. Report, then let the request continue.
    // noteDbUnavailable() dedupes an outage to one event rather than one per
    // page render.
    if (isConnectionError(e)) {
      noteDbUnavailable(e, { step: 'syncUserRow' });
      return;
    }
    Sentry.captureException(e, {
      tags: { component: 'auth', step: 'syncUserRow' },
      extra: { userId: user.id },
    });
  }
}

export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) await syncUserRow(user);
  return user;
}
