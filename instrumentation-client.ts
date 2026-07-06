import * as Sentry from '@sentry/nextjs';

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    // Replay integration is required for the replay*SampleRate below to do
    // anything. Record only sessions that hit an error (session rate 0) to
    // stay well within the free-tier quota while still capturing repros.
    integrations: [Sentry.replayIntegration()],
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? 'development',
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
