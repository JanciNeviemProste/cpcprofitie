import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/server';
import { getUserSubscription } from '@/lib/billing/subscription';
import { getStripe } from '@/lib/stripe/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: 'stripe_unavailable' }, { status: 503 });
  }
  const sub = await getUserSubscription(user.id);
  if (!sub?.stripeCustomerId) {
    return NextResponse.json({ error: 'no_customer' }, { status: 404 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${baseUrl}/app/billing`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error('stripe_portal_failed', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'portal_failed' }, { status: 502 });
  }
}
