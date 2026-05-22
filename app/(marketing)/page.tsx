import Link from 'next/link';
import { FeaturedDealCard } from '@/components/marketing/featured-deal-card';
import { CTABanner } from '@/components/marketing/cta-banner';
import { Comparison } from '@/components/marketing/comparison';
import { FAQ } from '@/components/marketing/faq';
import { FeatureGrid } from '@/components/marketing/feature-grid';
import { Hero } from '@/components/marketing/hero';
import { Pricing } from '@/components/marketing/pricing';
import { getTopFeaturedDeals, type DealCard } from '@/lib/db/queries/deals';

// Revalidate the public landing every 10 min — featured deals change as the
// weekly cron recomputes flip_opportunities. Cheap query (3 rows).
export const revalidate = 600;

async function loadFeaturedDeals(): Promise<DealCard[]> {
  try {
    return await getTopFeaturedDeals(3);
  } catch {
    // DB unreachable at build time or migration not yet applied — hide section.
    return [];
  }
}

export default async function HomePage() {
  const topDeals = await loadFeaturedDeals();

  return (
    <>
      <Hero />
      {topDeals.length > 0 ? (
        <section className="container mx-auto px-4 py-12">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="text-2xl font-bold tracking-tight">Dnešné top deals</h2>
            <Link
              href="/app/deals"
              className="text-primary text-sm hover:underline"
            >
              Všetky deals →
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {topDeals.map((d) => (
              <FeaturedDealCard key={d.listingId.toString()} deal={d} />
            ))}
          </div>
        </section>
      ) : null}
      <Comparison />
      <FeatureGrid />
      <Pricing />
      <FAQ />
      <CTABanner />
    </>
  );
}
