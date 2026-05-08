import {
  BarChart3,
  Bell,
  Car,
  GitCompare,
  LineChart,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

const features = [
  {
    icon: BarChart3,
    title: 'Prehľad trhu',
    description:
      'Denne agregované KPI po regiónoch — počet aktívnych inzerátov, priemerná cena, čas predaja a top trendy.',
  },
  {
    icon: LineChart,
    title: 'Analýza modelu',
    description:
      'Cenová distribúcia (p25 / medián / p75), časový rad za 12 mesiacov a podobné inzeráty na sklade.',
  },
  {
    icon: GitCompare,
    title: 'Porovnanie',
    description:
      'Head-to-head porovnanie dvoch modelov — likvidita, predajná rýchlosť, marža a sezónnosť.',
  },
  {
    icon: Sparkles,
    title: 'AI inzerát',
    description:
      'Vygeneruje predajný titulok a popis podľa značky, výbavy a tónu (formálny / energický / krátky) za 10 sekúnd.',
  },
  {
    icon: Car,
    title: 'Moja garáž',
    description:
      'Sledujte target margin pre každé auto na sklade. Upozorní vás, keď sa cenová pozícia v trhu zhorší.',
  },
  {
    icon: Bell,
    title: 'Sledované modely',
    description:
      'Nastavte kritériá (model, rok, km, región, max. cena). Príde e-mail hneď ako sa objaví zhoda.',
  },
  {
    icon: TrendingUp,
    title: 'Trhový pulz',
    description:
      'Anomálie a outliers — modely s neobvykle rýchlym pohybom alebo cenovou dislokáciou voči trhu.',
  },
];

export function FeatureGrid() {
  return (
    <section id="features" className="container mx-auto px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Sedem nástrojov, jeden dashboard
        </h2>
        <p className="text-muted-foreground mt-4 text-lg">
          Všetko, čo dealerský tím potrebuje na rozhodovanie podložené dátami — bez prepínania medzi
          piatimi nástrojmi.
        </p>
      </div>

      <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <div
              key={feature.title}
              className="border-border/40 bg-card/30 hover:border-primary/40 hover:bg-card/60 group relative overflow-hidden rounded-xl border p-6 transition-all"
            >
              <div className="bg-primary/10 text-primary mb-4 flex size-10 items-center justify-center rounded-lg">
                <Icon className="size-5" />
              </div>
              <h3 className="text-lg font-semibold tracking-tight">{feature.title}</h3>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
