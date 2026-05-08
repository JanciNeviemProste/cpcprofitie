import { SiteFooter } from '@/components/marketing/site-footer';
import { SiteHeader } from '@/components/marketing/site-header';

export const metadata = {
  title: 'Ochrana osobných údajov · CPCProfit',
};

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="container mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold tracking-tight">Ochrana osobných údajov</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Posledná aktualizácia: {new Date().toLocaleDateString('sk-SK')}
          </p>
          <div className="prose prose-invert mt-10 space-y-6 text-sm leading-relaxed">
            <p className="text-muted-foreground">
              Tento dokument je placeholder. Finálne znenie pripravíme s právnym poradcom v súlade
              s GDPR (Nariadenie EÚ 2016/679) a zákonom 18/2018 Z. z.
            </p>
            <h2 className="text-foreground text-xl font-semibold">1. Aké údaje spracúvame</h2>
            <p className="text-muted-foreground">
              Spracúvame e-mail, meno, fakturačné údaje a obchodné dáta o vašich vozidlách
              (zadávané vami v sekcii Garáž).
            </p>
            <h2 className="text-foreground text-xl font-semibold">2. Verejné inzeráty</h2>
            <p className="text-muted-foreground">
              Z verejných autobazárov agregujeme iba anonymizované metaúdaje (model, rok, km, cena,
              región). Telefónne čísla, e-maily ani mená predajcov nikdy neukladáme.
            </p>
            <h2 className="text-foreground text-xl font-semibold">3. Vaše práva</h2>
            <p className="text-muted-foreground">
              Máte právo na prístup, opravu, vymazanie a prenos údajov. Kontakt:{' '}
              <a href="mailto:privacy@cpcprofit.sk" className="text-primary hover:underline">
                privacy@cpcprofit.sk
              </a>
              .
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
