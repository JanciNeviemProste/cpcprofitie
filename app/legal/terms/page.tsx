import { SiteFooter } from '@/components/marketing/site-footer';
import { SiteHeader } from '@/components/marketing/site-header';

export const metadata = {
  title: 'Obchodné podmienky',
};

const LAST_UPDATED = '2026-05-08';

export default function TermsPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <article className="container mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
          <header>
            <h1 className="text-4xl font-bold tracking-tight">Obchodné podmienky</h1>
            <p className="text-muted-foreground mt-2 text-sm">
              Posledná aktualizácia: {LAST_UPDATED}
            </p>
            <div className="bg-muted/30 text-muted-foreground mt-6 rounded-lg border p-3 text-xs">
              Tento dokument je <strong>návrh pred právnym preskúmaním</strong>. Pred uvedením
              služby do produkcie ho overí slovenský právny poradca.
            </div>
          </header>

          <div className="prose prose-invert mt-10 space-y-8 text-sm leading-relaxed">
            <Section title="1. Všeobecné ustanovenia">
              <p>
                Tieto obchodné podmienky upravujú práva a povinnosti medzi spoločnosťou
                prevádzkujúcou platformu CPCProfit (ďalej „Poskytovateľ“) a klientom (ďalej
                „Užívateľ“), ktorý si zakúpil predplatné alebo využíva bezplatné skúšobné
                obdobie.
              </p>
              <p>
                Užívateľom môže byť fyzická osoba — podnikateľ alebo právnická osoba sídliaca v
                Európskej únii. Spotrebiteľ podľa zákona 250/2007 Z. z. o ochrane spotrebiteľa
                aktuálne nie je cieľovou skupinou platformy.
              </p>
            </Section>

            <Section title="2. Predmet zmluvy">
              <p>
                Poskytovateľ poskytuje SaaS platformu pre analýzu trhu vozidiel — agregované
                ceny verejne dostupných inzerátov, AI generovanie textov inzerátov, sledovanie
                modelov a porovnania. Plný rozsah funkcií podľa zvoleného plánu (Free / Plus /
                Premium).
              </p>
            </Section>

            <Section title="3. Cena, platba a fakturácia">
              <p>
                Predplatné sa účtuje mesačne alebo ročne v mene EUR cez platobnú bránu Stripe
                Payments Europe Ltd. K cenám sa pripočítava DPH podľa platnej legislatívy.
                Faktúra je doručená e-mailom do 24 hodín od úhrady.
              </p>
              <p>
                Skúšobné obdobie 7 dní je bezplatné a bez záväzku platobnej karty. Po jeho
                uplynutí sa služba automaticky neaktivuje — Užívateľ si predplatné objedná
                manuálne.
              </p>
            </Section>

            <Section title="4. Odstúpenie od zmluvy a refundácie">
              <p>
                Užívateľ môže predplatné kedykoľvek zrušiť cez Customer Portal. Prístup zostane
                aktívny do konca zaplateného obdobia, automatická obnova sa nespustí. Pomerná
                refundácia sa neposkytuje.
              </p>
            </Section>

            <Section title="5. Prípustné použitie">
              <p>
                Užívateľ sa zaväzuje nepoužívať platformu na automatizované sťahovanie dát mimo
                rozsahu API kvóty zvoleného plánu, na reverzné inžinierstvo modelov, ani na
                vytváranie konkurenčného produktu kopírovaním obsahu.
              </p>
            </Section>

            <Section title="6. Obmedzenie zodpovednosti">
              <p>
                Údaje o cenách sú agregované z verejných inzerátov a slúžia ako podklad pre
                rozhodovanie. Poskytovateľ neručí za presnosť každého jednotlivého záznamu ani
                za zisk plynúci z rozhodnutí Užívateľa. Maximálna náhrada škody je
                limitovaná zaplateným ročným poplatkom.
              </p>
            </Section>

            <Section title="7. Zmena podmienok">
              <p>
                Poskytovateľ môže tieto podmienky upraviť. Materiálna zmena je oznámená 30 dní
                vopred e-mailom. Ak Užívateľ so zmenou nesúhlasí, môže predplatné zrušiť do
                konca aktuálneho obdobia.
              </p>
            </Section>

            <Section title="8. Kontakt">
              <p>
                Otázky a reklamácie:{' '}
                <a href="mailto:hello@cpcprofit.sk" className="text-primary hover:underline">
                  hello@cpcprofit.sk
                </a>
                .
              </p>
            </Section>
          </div>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-foreground text-xl font-semibold">{title}</h2>
      <div className="text-muted-foreground mt-3 space-y-3">{children}</div>
    </section>
  );
}
