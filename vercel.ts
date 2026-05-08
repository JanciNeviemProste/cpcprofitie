import { type VercelConfig } from '@vercel/config/v1';

export const config: VercelConfig = {
  buildCommand: 'next build',
  framework: 'nextjs',
  crons: [
    // Aktivuje sa vo Fáze 4 (scraping pipeline)
    // { path: '/api/cron/dispatch-scrape', schedule: '0 */6 * * *' },
  ],
};

export default config;
