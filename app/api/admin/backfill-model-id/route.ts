import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { isAdminEmail } from '@/lib/auth/admin';
import { getCurrentUser } from '@/lib/auth/server';
import { backfillModelId } from '@/lib/analytics/backfill-model-id';

// Resolve model_id for historical listings that have a title but no model_id
// (starves DealScore cohorts). Auth: admin session OR CRON_SECRET bearer.
// Bounded per call — loop until stats.remaining is 0. `?dryRun=1` resolves
// without writing; `?limit=N` caps the batch.
export const runtime = 'nodejs';
export const maxDuration = 300;

async function authorize(request: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  if (secret && auth === `Bearer ${secret}`) return true;
  const user = await getCurrentUser();
  return isAdminEmail(user?.email);
}

export async function GET(request: Request) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const url = new URL(request.url);
  const dryRun = url.searchParams.get('dryRun') === '1';
  const limitParam = Number(url.searchParams.get('limit'));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : undefined;
  // Pass ?afterId=<nextCursor> from the previous response to continue the walk.
  const afterIdParam = url.searchParams.get('afterId');
  const afterId = afterIdParam && /^\d+$/.test(afterIdParam) ? BigInt(afterIdParam) : undefined;

  const startedAt = Date.now();
  try {
    const stats = await backfillModelId({ dryRun, limit, afterId });
    return NextResponse.json({ stats, elapsedMs: Date.now() - startedAt });
  } catch (e) {
    Sentry.captureException(e, { tags: { component: 'backfill-model-id-api' } });
    return NextResponse.json(
      { error: 'backfill_failed', message: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

export const POST = GET;
