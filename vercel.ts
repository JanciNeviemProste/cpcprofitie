import { type VercelConfig } from '@vercel/config/v1';

export const config: VercelConfig = {
  buildCommand: 'next build',
  framework: 'nextjs',
  crons: [
    // Every 6 hours: dispatch a scrape job per configured source.
    // Activated when the project is linked to Vercel and CRON_SECRET is set.
    { path: '/api/cron/dispatch-scrape', schedule: '0 */6 * * *' },
  ],
};

export default config;
