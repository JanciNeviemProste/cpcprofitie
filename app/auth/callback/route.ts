import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/auth/server';
import { checkBotIdSafe } from '@/lib/botid';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/app/overview';

  const bot = await checkBotIdSafe(request);
  if (bot.isBot) {
    return NextResponse.redirect(new URL('/login?error=bot_detected', url.origin));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', url.origin));
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.redirect(new URL('/login?error=supabase_not_configured', url.origin));
  }
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin),
    );
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
