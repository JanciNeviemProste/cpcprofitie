import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/server';
import { scrapeAutobazarSk } from '@/lib/scraping';

export const runtime = 'nodejs';
export const maxDuration = 300;

// Manual trigger for the autobazar.sk scraper. Admin-gated so a regular user
// can't burn quota or trip the source's rate-limits. The Vercel cron at
// /api/cron/dispatch-scrape calls this in production via Queues.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  // TODO: lookup user role from DB; until then admin-by-allowlist via env.
  const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map((s) => s.trim());
  if (!adminEmails.includes(user.email ?? '')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { pages?: number };
  const result = await scrapeAutobazarSk({ pages: Math.min(body.pages ?? 1, 10) });

  // TODO once DB env is configured: upsert listings + persist scrape_runs row.
  return NextResponse.json({
    source: result.source,
    pagesVisited: result.pagesVisited,
    listingsFound: result.listings.length,
    errors: result.errors,
    sample: result.listings.slice(0, 3),
  });
}
