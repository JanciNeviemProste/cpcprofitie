import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/server';
import { scrapeAutobazarSk } from '@/lib/scraping';

export const runtime = 'nodejs';
export const maxDuration = 300;

const BodySchema = z.object({
  pages: z.coerce.number().int().min(1).max(10).default(1),
});

function parseAdminAllowlist(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user?.email) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const allowlist = parseAdminAllowlist();
  if (allowlist.length === 0 || !allowlist.includes(user.email.toLowerCase())) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let raw: unknown = {};
  try {
    raw = await request.json();
  } catch {
    // empty body is fine — we use defaults
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const result = await scrapeAutobazarSk({ pages: parsed.data.pages });
    const status =
      result.errors.length === 0
        ? 200
        : result.listings.length > 0
          ? 207 // partial success
          : 502;

    if (result.errors.length > 0) {
      console.error('scrape_partial_or_failed', {
        source: result.source,
        errors: result.errors,
        listingsFound: result.listings.length,
      });
    }

    return NextResponse.json(
      {
        source: result.source,
        pagesVisited: result.pagesVisited,
        listingsFound: result.listings.length,
        errors: result.errors,
        sample: result.listings.slice(0, 3),
      },
      { status },
    );
  } catch (e) {
    console.error('scrape_unexpected_failure', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'scrape_unavailable' }, { status: 500 });
  }
}
