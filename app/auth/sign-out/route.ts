import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/auth/server';
import { isSameOrigin } from '@/lib/auth/csrf';

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
