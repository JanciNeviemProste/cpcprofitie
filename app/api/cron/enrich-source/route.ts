import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { getSource } from '@/lib/scraping';
import { loadUnenrichedBatch } from '@/lib/scraping/enrich-batch-loader';
import { persistDetails, runEnrichment } from '@/lib/scraping';
import { ALL_SOURCES, type Source } from '@/lib/scraping';

// Server-side detail enrichment for a single source. Driven by a local Bash
// loop that POSTs repeatedly until { done: true }. Each invocation runs as
// many 50-row batches as fit in the 280s budget (≈ 230 listings @ 1.2s).
export const runtime = 'nodejs';
export const maxDuration = 300;

const PROD = process.env.VERCEL_ENV === 'production';
const BATCH_SIZE = 50;
const DELAY_MS = 1200;
// 3 batches of 50 listings at 1.2s = ~180s, plus DB writes + overhead.
// Keep under 220s so the response definitely returns within Vercel's 300s
// hard limit even if the last batch starts late.
const TIME_BUDGET_MS = 180_000;

export async function POST(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    if (PROD) return NextResponse.json({ error: 'cron_secret_unset' }, { status: 503 });
  } else {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  let payload: { source?: string } = {};
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }
  const sourceId = payload.source;
  if (!sourceId || !ALL_SOURCES.includes(sourceId as Source)) {
    return NextResponse.json(
      { error: 'invalid_source', valid: ALL_SOURCES },
      { status: 400 },
    );
  }
  const source = getSource(sourceId as Source);
  if (!source.detailUrl || !source.parseDetailPage) {
    return NextResponse.json({ error: 'source_has_no_detail_parser' }, { status: 400 });
  }

  const startedAt = Date.now();
  const deadline = startedAt + TIME_BUDGET_MS;
  let totalFetched = 0;
  let totalDetails = 0;
  let totalErrors = 0;
  let batches = 0;
  let done = false;

  while (Date.now() < deadline) {
    let batch;
    try {
      batch = await loadUnenrichedBatch(sourceId as Source, BATCH_SIZE);
    } catch (e) {
      Sentry.captureException(e, {
        tags: { component: 'enrich-source', step: 'loadBatch', source: sourceId },
      });
      return NextResponse.json(
        { error: 'load_batch_failed', message: e instanceof Error ? e.message : String(e) },
        { status: 500 },
      );
    }
    if (batch.length === 0) {
      done = true;
      break;
    }
    batches++;
    try {
      const result = await runEnrichment(source, batch, {
        limit: BATCH_SIZE,
        delayMs: DELAY_MS,
      });
      if (result.details.length > 0) await persistDetails(result.details);
      totalFetched += result.fetched;
      totalDetails += result.details.length;
      totalErrors += result.errors.length;
    } catch (e) {
      totalErrors++;
      Sentry.captureException(e, {
        tags: { component: 'enrich-source', step: 'runEnrichment', source: sourceId },
      });
      // Don't fail the whole invocation — log and continue to the next batch.
    }
  }

  return NextResponse.json({
    source: sourceId,
    done,
    batches,
    totalFetched,
    totalDetails,
    totalErrors,
    elapsedMs: Date.now() - startedAt,
  });
}
