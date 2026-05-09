import { NextResponse } from 'next/server';

// Vercel Cron entry point. Currently a stub: returns the source list that
// *would* be enqueued. Once Vercel Queues is provisioned, replace the
// enqueue loop body with `queue.send()` so workers can pick up the jobs and
// run the scraper. Scheduled in vercel.ts as `0 */6 * * *`.
export const runtime = 'nodejs';
export const maxDuration = 60;

const SOURCES = ['autobazar.sk'] as const;
const PROD = process.env.VERCEL_ENV === 'production';

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    // Refuse to run unauthenticated in production. In dev we let it through so
    // the endpoint can be exercised without env wiring.
    if (PROD) {
      return NextResponse.json({ error: 'cron_secret_unset' }, { status: 503 });
    }
  } else {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const enqueued: string[] = [];
  for (const source of SOURCES) {
    // TODO once Vercel Queues is provisioned, replace with queue.send().
    enqueued.push(source);
  }

  return NextResponse.json({
    dispatchedAt: new Date().toISOString(),
    enqueued,
    note: 'Stub — wire to Vercel Queues + Sandbox worker after provisioning.',
  });
}
