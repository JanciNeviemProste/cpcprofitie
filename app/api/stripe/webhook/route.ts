import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { subscriptions } from '@/lib/db/schema';
import { planFromStripePriceId } from '@/lib/billing/plans';
import { getStripe } from '@/lib/stripe/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RELEVANT_EVENTS = new Set<Stripe.Event['type']>([
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_failed',
]);

export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return NextResponse.json({ error: 'stripe_unavailable' }, { status: 503 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'missing_signature' }, { status: 400 });
  }

  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (e) {
    console.error('stripe_signature_invalid', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 });
  }

  if (!RELEVANT_EVENTS.has(event.type)) {
    return NextResponse.json({ received: true, ignored: true });
  }

  try {
    if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated'
    ) {
      await upsertSubscription(event.data.object);
    } else if (event.type === 'customer.subscription.deleted') {
      await markCanceled(event.data.object);
    } else if (event.type === 'invoice.payment_failed') {
      // Just log — Stripe will retry, and we'll get a customer.subscription.updated
      // when status flips to past_due/unpaid.
      console.warn('stripe_payment_failed', {
        invoice: (event.data.object as Stripe.Invoice).id,
      });
    }
    return NextResponse.json({ received: true });
  } catch (e) {
    console.error('stripe_webhook_handler_failed', {
      event: event.type,
      error: e instanceof Error ? e.message : e,
    });
    // 5xx so Stripe retries — never swallow handler errors silently.
    return NextResponse.json({ error: 'handler_failed' }, { status: 500 });
  }
}

async function upsertSubscription(s: Stripe.Subscription) {
  const userId = (s.metadata as Record<string, string> | null)?.userId;
  if (!userId) {
    console.warn('stripe_subscription_missing_user_metadata', { id: s.id });
    return;
  }
  const item = s.items.data[0];
  const priceId = item?.price.id ?? null;
  const plan = planFromStripePriceId(priceId);
  const customerId = typeof s.customer === 'string' ? s.customer : s.customer.id;
  // Period info moved from the subscription to its items in modern Stripe APIs.
  const periodStart = item?.current_period_start
    ? new Date(item.current_period_start * 1000)
    : null;
  const periodEnd = item?.current_period_end
    ? new Date(item.current_period_end * 1000)
    : null;

  const db = getDb();
  await db
    .insert(subscriptions)
    .values({
      userId,
      plan,
      status: s.status,
      stripeCustomerId: customerId,
      stripeSubscriptionId: s.id,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: s.cancel_at_period_end ?? false,
    })
    .onConflictDoUpdate({
      target: subscriptions.stripeSubscriptionId,
      set: {
        plan,
        status: s.status,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: s.cancel_at_period_end ?? false,
        updatedAt: new Date(),
      },
    });
}

async function markCanceled(s: Stripe.Subscription) {
  const db = getDb();
  await db
    .update(subscriptions)
    .set({ status: 'canceled', updatedAt: new Date() })
    .where(eq(subscriptions.stripeSubscriptionId, s.id));
}
