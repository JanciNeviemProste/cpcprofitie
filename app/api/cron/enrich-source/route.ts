import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { getSource } from '@/lib/scraping';
import {
  loadUnenrichedBatch,
  type EnrichSelectMode,
} from '@/lib/scraping/enrich-batch-loader';
import { persistDetails, runEnrichment } from '@/lib/scraping';
import { ALL_SOURCES, type Source } from '@/lib/scraping';

// Server-side detail enrichment for a single source. Driven by a local Bash
// loop that POSTs repeatedly until { done: true }. Each invocation runs as
// many 50-row batches as fit in the 280s budget (≈ 230 listings @ 1.2s).
export const runtime = 'nodejs';
export const maxDuration = 300;

const PROD = process.env.VERCEL_ENV === 'production';
// Smaller batches mean more frequent deadline checks. Real-world detail
// page fetches take 3-10s (not just the 1.2s crawl delay) so a batch of 10
// fits in ~60s and we get 3-4 batches per 220s budget.
const BATCH_SIZE = 10;
const DELAY_MS = 1200;
const TIME_BUDGET_MS = 220_000;

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

  let payload: {
    source?: string;
    partition?: number;
    modulo?: number;
    mode?: string;
  } = {};
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }
  const sourceId = payload.source;
  // 'null-price' re-fetches detail pages for active listings still missing a
  // price (backfill); default 'unenriched' keeps the normal first-pass flow.
  const mode: EnrichSelectMode = payload.mode === 'null-price' ? 'null-price' : 'unenriched';
  // Optional id-based partitioning so N shells can run in parallel on
  // disjoint id subsets.
  const partition =
    typeof payload.partition === 'number' &&
    typeof payload.modulo === 'number' &&
    payload.modulo > 1 &&
    payload.partition >= 0 &&
    payload.partition < payload.modulo
      ? { index: payload.partition, modulo: payload.modulo }
      : undefined;
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
  // null-price mode advances a cursor so rows that can't yield a price don't
  // get re-selected forever within one invocation.
  let cursor: bigint | undefined;
  const sampleErrors: string[] = [];

  while (Date.now() < deadline) {
    let batch;
    try {
      batch = await loadUnenrichedBatch(sourceId as Source, BATCH_SIZE, partition, mode, cursor);
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
    // Advance the null-price cursor past this batch (rawPayload.__cursorId).
    if (mode === 'null-price') {
      const lastId = batch[batch.length - 1]?.rawPayload?.__cursorId;
      if (typeof lastId === 'string') cursor = BigInt(lastId);
    }
    try {
      const result = await runEnrichment(source, batch, {
        limit: BATCH_SIZE,
        delayMs: DELAY_MS,
      });
      if (result.details.length > 0) await persistDetails(result.details);
      totalFetched += result.fetched;
      totalDetails += result.details.length;
      totalErrors += result.errors.length;
      for (const e of result.errors) {
        if (sampleErrors.length < 5) sampleErrors.push(e);
      }
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
    sampleErrors,
    elapsedMs: Date.now() - startedAt,
  });
}
