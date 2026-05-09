// Same-origin gate for state-changing POST endpoints. Used by /auth/sign-out
// and the Stripe POST routes that have side-effects (Checkout, Customer
// Portal). Modern browsers attach `Sec-Fetch-Site` automatically; we fall
// back to comparing `origin`/`referer` host against the request host so
// older clients still work.

export function isSameOrigin(request: Request): boolean {
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
