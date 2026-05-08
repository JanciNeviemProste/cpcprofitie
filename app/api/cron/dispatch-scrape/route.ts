import { NextResponse } from 'next/server';

// Vercel Cron entry point. Activated in vercel.ts when the project is linked
// and Vercel Queues is provisioned. For each configured source it enqueues a
// job; workers pick them up and run the actual scraper.
export const runtime = 'nodejs';
export const maxDuration = 60;

const SOURCES = ['autobazar.sk'] as const;

export async function GET(request: Request) {
  // Vercel Cron calls this with a generated bearer; verify before enqueueing.
  const auth = request.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
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
