import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { getDataQualityReport, pickDriftAlerts } from '@/lib/db/queries/data-quality';

// Daily data-quality watchdog (08:00 UTC via vercel.json). Runs the read-only
// data-quality report and raises a Sentry warning when any source's key-field
// coverage looks like selector drift (health 'drift') or is degraded ('warn').
// This is what turns "autobazar.sk price went 100% null" from a months-later
// discovery into a same-day alert.
export const runtime = 'nodejs';
export const maxDuration = 60;

const PROD = process.env.VERCEL_ENV === 'production';

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    if (PROD) return NextResponse.json({ error: 'cron_secret_unset' }, { status: 503 });
  } else {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const startedAt = Date.now();
  try {
    const report = await getDataQualityReport();
    const alerts = pickDriftAlerts(report);
    const drift = alerts.filter((a) => a.health === 'drift');

    if (drift.length > 0) {
      Sentry.captureMessage(
        `Data-quality drift: ${drift.map((d) => `${d.source} (${d.reason})`).join('; ')}`,
        { level: 'warning', tags: { component: 'data-quality-alert' }, extra: { alerts } },
      );
    } else if (alerts.length > 0) {
      // Degraded-but-not-drift: keep it at info so it's visible without paging.
      Sentry.captureMessage(
        `Data-quality warn: ${alerts.map((a) => a.source).join(', ')}`,
        { level: 'info', tags: { component: 'data-quality-alert' }, extra: { alerts } },
      );
    }

    return NextResponse.json({
      runAt: new Date(report.generatedAt).toISOString(),
      driftCount: drift.length,
      warnCount: alerts.length - drift.length,
      alerts,
      elapsedMs: Date.now() - startedAt,
    });
  } catch (e) {
    Sentry.captureException(e, { tags: { component: 'data-quality-alert' } });
    return NextResponse.json(
      { error: 'alert_failed', message: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

// Also support POST for manual/scripted invocation.
export const POST = GET;
