import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/server';
import { PLANS } from '@/lib/billing/plans';
import { getStripe } from '@/lib/stripe/server';

export const runtime = 'nodejs';

const BodySchema = z.object({
  priceId: z.string().min(8),
  successPath: z.string().regex(/^\/(?!\/)/).default('/app/billing?status=success'),
  cancelPath: z.string().regex(/^\/(?!\/)/).default('/app/billing?status=cancel'),
});

function isKnownPriceId(priceId: string): boolean {
  return Object.values(PLANS).some(
    (p) => p.stripePriceMonthly === priceId || p.stripePriceYearly === priceId,
  );
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user?.email) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: 'stripe_unavailable' }, { status: 503 });
  }

  const json = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  if (!isKnownPriceId(parsed.data.priceId)) {
    return NextResponse.json({ error: 'unknown_price_id' }, { status: 400 });
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: parsed.data.priceId, quantity: 1 }],
      customer_email: user.email,
      client_reference_id: user.id,
      metadata: { userId: user.id },
      success_url: `${baseUrl}${parsed.data.successPath}`,
      cancel_url: `${baseUrl}${parsed.data.cancelPath}`,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
    });
    if (!session.url) {
      return NextResponse.json({ error: 'session_url_missing' }, { status: 502 });
    }
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error('stripe_checkout_failed', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'checkout_failed' }, { status: 502 });
  }
}
