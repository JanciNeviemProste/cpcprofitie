import * as Sentry from '@sentry/nextjs';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
    environment: process.env.VERCEL_ENV ?? 'development',
    // Attach local variable values to server stack frames — makes cron /
    // scraper exceptions far easier to diagnose from the Sentry issue alone.
    includeLocalVariables: true,
    debug: false,
  });
}
