import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/auth/server';

// CSRF guard: only accept sign-out POSTs that originate from the same site.
// Modern browsers attach `Sec-Fetch-Site` automatically; we require either
// `same-origin` or, as a fallback, an `origin`/`referer` host that matches the
// request host. This blocks drive-by sign-out from a malicious page.
function isSameOrigin(request: Request): boolean {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite === 'same-origin' || fetchSite === 'same-site') return true;

  const host = request.headers.get('host');
  const originHost = headerHost(request.headers.get('origin'));
  if (host && originHost && host === originHost) return true;

  const refererHost = headerHost(request.headers.get('referer'));
  if (host && refererHost && host === refererHost) return true;

  return false;
}

function headerHost(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  try {
    const supabase = await createSupabaseServerClient();
    if (supabase) await supabase.auth.signOut();
  } catch (e) {
    console.error('sign_out_failed', e instanceof Error ? e.message : e);
    return NextResponse.redirect(new URL('/?error=signout_failed', request.url), { status: 303 });
  }

  return NextResponse.redirect(new URL('/', request.url), { status: 303 });
}
