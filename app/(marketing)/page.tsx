import { CTABanner } from '@/components/marketing/cta-banner';
import { Comparison } from '@/components/marketing/comparison';
import { FAQ } from '@/components/marketing/faq';
import { FeatureGrid } from '@/components/marketing/feature-grid';
import { Hero } from '@/components/marketing/hero';
import { Pricing } from '@/components/marketing/pricing';

export default function HomePage() {
  return (
    <>
      <Hero />
      <Comparison />
      <FeatureGrid />
      <Pricing />
      <FAQ />
      <CTABanner />
    </>
  );
}
