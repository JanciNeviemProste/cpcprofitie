// Outbound e-mail via Resend. Same optional-integration convention as the
// AI Gateway (app/api/ai/listing/route.ts): without RESEND_API_KEY every
// send is logged and skipped (mode 'mock') — callers never have to guard.

import * as Sentry from '@sentry/nextjs';
import { Resend } from 'resend';

export type EmailItem = {
  to: string;
  subject: string;
  html: string;
};

export type SendResult = {
  sent: number;
  skipped: number;
  errors: number;
  mode: 'live' | 'mock';
  /** Recipients from chunks that were accepted by Resend — callers use this
   *  for per-user bookkeeping so a partial chunk failure doesn't re-send to
   *  everyone on retry. Empty in mock mode. */
  sentTo: string[];
};

// Resend batch endpoint accepts up to 100 messages per request; the API is
// rate-limited (~2 req/s), so chunks are sent with a small pause between.
const BATCH_SIZE = 100;
const INTER_CHUNK_DELAY_MS = 600;

export function isEmailLive(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export function getEmailFrom(): string {
  return process.env.EMAIL_FROM ?? 'CPCProfit <onboarding@resend.dev>';
}

let client: Resend | null = null;

function getResend(): Resend {
  if (!client) client = new Resend(process.env.RESEND_API_KEY);
  return client;
}

export async function sendEmailBatch(items: EmailItem[]): Promise<SendResult> {
  if (items.length === 0) {
    return { sent: 0, skipped: 0, errors: 0, mode: isEmailLive() ? 'live' : 'mock', sentTo: [] };
  }

  if (!isEmailLive()) {
    for (const item of items) {
      console.warn('[email] mock send:', item.to, '—', item.subject);
    }
    return { sent: 0, skipped: items.length, errors: 0, mode: 'mock', sentTo: [] };
  }

  const resend = getResend();
  const from = getEmailFrom();
  const result: SendResult = { sent: 0, skipped: 0, errors: 0, mode: 'live', sentTo: [] };

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const chunk = items.slice(i, i + BATCH_SIZE);
    try {
      const { error } = await resend.batch.send(
        chunk.map((item) => ({
          from,
          to: item.to,
          subject: item.subject,
          html: item.html,
        })),
      );
      if (error) {
        result.errors += chunk.length;
        Sentry.captureException(new Error(`resend_batch_failed: ${error.message}`), {
          tags: { component: 'email', step: 'sendEmailBatch' },
          extra: { chunkSize: chunk.length },
        });
      } else {
        result.sent += chunk.length;
        result.sentTo.push(...chunk.map((item) => item.to));
      }
    } catch (e) {
      result.errors += chunk.length;
      Sentry.captureException(e, {
        tags: { component: 'email', step: 'sendEmailBatch' },
        extra: { chunkSize: chunk.length },
      });
    }
    if (i + BATCH_SIZE < items.length) {
      await new Promise((r) => setTimeout(r, INTER_CHUNK_DELAY_MS));
    }
  }

  return result;
}
