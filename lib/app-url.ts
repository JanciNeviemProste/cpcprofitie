// Base URL for links generated outside a request context (e-mails, crons).
// Falls back to the live deployment — the branded cpcprofit.sk domain isn't
// registered yet, so a fallback pointing there would produce dead links.
// (sitemap/robots/layout still use the branded fallback; unify once the
// domain exists.)
export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'https://cpcprofitie.vercel.app';
}
