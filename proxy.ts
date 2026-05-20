import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

const PROD = process.env.VERCEL_ENV === 'production';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const isAppRoute = request.nextUrl.pathname.startsWith('/app');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    // Fail closed in production so a misconfigured deploy never exposes /app.
    // In dev / preview we let the request through so the demo UI keeps working.
    if (PROD && isAppRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('error', 'auth_unavailable');
      return NextResponse.redirect(url);
    }
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          request.cookies.set({ name, value, ...options }),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // TEMP demo unlock: /app/listings is publicly accessible while Supabase
  // GoTrue auth backend is broken. Revert once auth is restored.
  const isPublicDemo = request.nextUrl.pathname.startsWith('/app/listings');

  if (isAppRoute && !user && !isPublicDemo) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    // Preserve the destination, but only the path portion — never the host.
    url.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
