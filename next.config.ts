import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

// Baseline security headers. Tightened CSP can come once we know all
// third-party origins (Sentry CDN, Vercel Analytics, Stripe Checkout, etc.).
// `'unsafe-inline'` for styles is currently required by Tailwind v4 in dev
// mode and by next/font CSS injection.
const SECURITY_HEADERS = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "img-src 'self' data: blob: https:",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https://*.supabase.co https://*.sentry.io wss: https:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  async headers() {
    return [{ source: '/(.*)', headers: SECURITY_HEADERS }];
  },
  // Hot-link listing photos straight from each marketplace's CDN. We never
  // rehost; next/image still optimises (resize, AVIF) on Vercel's edge.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 's.autobazar.eu' },
      { protocol: 'https', hostname: 'img.autobazar.eu' },
      { protocol: 'https', hostname: 'img.autobazar.sk' },
      { protocol: 'https', hostname: 'img.bazos.sk' },
    ],
  },
  poweredByHeader: false,
};

// Sentry must wrap the outermost config (after the next-intl plugin). This
// enables source-map upload (readable prod stack traces — only runs when
// SENTRY_AUTH_TOKEN is present at build time, otherwise silently skipped) and
// the /monitoring tunnel route that routes client events through our own
// origin so ad-blockers don't drop them. org/project come from env so the
// slug isn't hardcoded across environments.
export default withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT ?? 'cpcprofit',
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  tunnelRoute: '/monitoring',
  silent: !process.env.CI,
});
