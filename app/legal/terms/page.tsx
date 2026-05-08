import { SiteFooter } from '@/components/marketing/site-footer';
import { SiteHeader } from '@/components/marketing/site-header';

export const metadata = {
  title: 'Obchodné podmienky · CPCProfit',
};

export default function TermsPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="container mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold tracking-tight">Obchodné podmienky</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Posledná aktualizácia: {new Date().toLocaleDateString('sk-SK')}
          </p>
          <div className="prose prose-invert mt-10 space-y-6 text-sm leading-relaxed">
            <p className="text-muted-foreground">
              Tento dokument je placeholder. Pred spustením do produkcie ho nahradí finálne znenie
              skontrolované právnym oddelením.
            </p>
            <h2 className="text-foreground text-xl font-semibold">1. Predmet zmluvy</h2>
            <p className="text-muted-foreground">
              CPCProfit poskytuje SaaS platformu pre analýzu trhu vozidiel formou predplatného.
            </p>
            <h2 className="text-foreground text-xl font-semibold">2. Cena a platba</h2>
            <p className="text-muted-foreground">
              Predplatné je účtované mesačne alebo ročne podľa zvoleného plánu cez Stripe.
            </p>
            <h2 className="text-foreground text-xl font-semibold">3. Trvanie a ukončenie</h2>
            <p className="text-muted-foreground">
              Predplatné si môžete kedykoľvek zrušiť cez Customer Portal. Prístup zostáva aktívny do
              konca zaplateného obdobia.
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
