import { type VercelConfig } from '@vercel/config/v1';

export const config: VercelConfig = {
  buildCommand: 'next build',
  framework: 'nextjs',
  crons: [
    // Every 6 hours: dispatch a scrape job per configured source.
    // Activated when the project is linked to Vercel and CRON_SECRET is set.
    //
    // NOTE: Sub-daily schedules require a Vercel Pro plan. On Hobby/Free the
    // import will fail with "Hobby accounts are limited to daily cron jobs".
    // For Hobby use `'0 4 * * *'` (once a day, 04:00 UTC = 05:00 SK) instead.
    { path: '/api/cron/dispatch-scrape', schedule: '0 */6 * * *' },
    // Sunday 02:00 UTC: cluster reposts, compute weekly snapshots + flips.
    { path: '/api/cron/weekly-maintenance', schedule: '0 2 * * 0' },
    // Daily 03:00 UTC: HEAD-check 1/7 of active bazos+autobazar.sk listings;
    // 404/410 → mark removed_at.
    { path: '/api/cron/check-removed', schedule: '0 3 * * *' },
  ],
};

export default config;
