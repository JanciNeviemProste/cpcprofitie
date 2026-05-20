import Link from 'next/link';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const plans = [
  {
    name: 'Free',
    price: '€0',
    period: '7 dní',
    description: 'Skúsite si platformu bez záväzkov.',
    cta: 'Začať skúšobné obdobie',
    href: '/register',
    highlighted: false,
    features: [
      '3 analýzy modelov',
      '3 AI inzeráty',
      '1 sledovaný model',
      'Prehľad trhu (limitovaný)',
      'E-mail podpora',
    ],
  },
  {
    name: 'Plus',
    price: '€19',
    period: 'mesačne',
    description: 'Pre solo dealerov a malé bazáre.',
    cta: 'Zvoliť Plus',
    href: '/register?plan=plus',
    highlighted: true,
    features: [
      'Neobmedzené analýzy a porovnania',
      '50 AI inzerátov mesačne',
      '5 sledovaných modelov',
      'E-mail alerty (1 / deň)',
      'Plný prehľad trhu',
      'Moja garáž (do 20 áut)',
    ],
  },
  {
    name: 'Premium',
    price: '€49',
    period: 'mesačne',
    description: 'Pre tímy a väčšie autobazáre.',
    cta: 'Zvoliť Premium',
    href: '/register?plan=premium',
    highlighted: false,
    features: [
      'Všetko z Plus',
      'Neobmedzené AI inzeráty',
      'Neobmedzené sledované modely',
      'Real-time alerty (push + e-mail)',
      'Anomalie a trhový pulz',
      'API prístup',
      'Prioritná podpora < 4h',
    ],
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="container mx-auto px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Jednoduché ceny. Žiadne prekvapenia.
        </h2>
        <p className="text-muted-foreground mt-4 text-lg">
          Všetky plány zahŕňajú 7-dňové bezplatné skúšobné obdobie. Bez platobnej karty.
        </p>
      </div>

      <div className="mx-auto mt-14 grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={
              plan.highlighted
                ? 'border-primary bg-card relative rounded-2xl border-2 p-8 shadow-lg'
                : 'border-border/40 bg-card/30 relative rounded-2xl border p-8'
            }
          >
            {plan.highlighted && (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Najobľúbenejšie</Badge>
            )}
            <h3 className="text-lg font-semibold tracking-tight">{plan.name}</h3>
            <p className="text-muted-foreground mt-1 text-sm">{plan.description}</p>
            <div className="mt-6 flex items-baseline gap-1">
              <span className="text-4xl font-bold tracking-tight">{plan.price}</span>
              <span className="text-muted-foreground text-sm">/ {plan.period}</span>
            </div>
            <Button
              variant={plan.highlighted ? 'default' : 'outline'}
              className="mt-6 w-full"
              render={<Link href={plan.href} />}
            >
              {plan.cta}
            </Button>
            <ul className="mt-8 space-y-3">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm">
                  <Check className="text-primary mt-0.5 size-4 shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="text-muted-foreground mt-8 text-center text-sm">
        Cena bez DPH. Pri ročnej platbe ušetríte 2 mesiace.
      </p>
    </section>
  );
}
