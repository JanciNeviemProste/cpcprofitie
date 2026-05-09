import Stripe from 'stripe';

let cached: Stripe | null = null;

// Lazy singleton. Returns null when STRIPE_SECRET_KEY is unset so route
// handlers can return 503 instead of crashing during dev or in environments
// where billing is intentionally disabled.
export function getStripe(): Stripe | null {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  cached = new Stripe(key, {
    apiVersion: '2026-04-22.dahlia',
    typescript: true,
  });
  return cached;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
