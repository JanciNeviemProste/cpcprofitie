import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const items = [
  {
    q: 'Odkiaľ pochádzajú dáta o cenách?',
    a: 'Agregujeme verejné inzeráty zo slovenských a stredoeurópskych autobazárov v 6-hodinových intervaloch. Spracúvame výhradne anonymizované metaúdaje (model, rok, km, cena, región) — žiadne kontaktné údaje predajcov.',
  },
  {
    q: 'Ako často sa dáta aktualizujú?',
    a: 'Listingy sa zbierajú každých 6 hodín. Trhové agregáty (priemery, mediány, distribúcie) sa prepočítavajú nightly. AI insights a watchlist alerty fungujú v reálnom čase.',
  },
  {
    q: 'Ako zruším predplatné?',
    a: 'Kedykoľvek priamo z účtu cez Stripe Customer Portal — jedným klikom, bez telefonátov a "udržiavania". Prístup vám zostane do konca zaplateného obdobia.',
  },
  {
    q: 'Funguje CPCProfit aj pre českú alebo rakúsku stranu trhu?',
    a: 'Aktuálne sú primárnym zdrojom slovenské bazáre. Nemecké a české feedy sú v príprave a dostupné v Premium pláne v priebehu roka.',
  },
  {
    q: 'Je platforma vhodná aj pre súkromníkov, nie len pre dealerov?',
    a: 'Áno — pre súkromného predajcu, ktorý raz za pár rokov mení auto, je Free plán postačujúci. Plus a Premium sú navrhnuté pre profesionálov, ktorí točia desiatky áut mesačne.',
  },
  {
    q: 'Aké AI modely sa používajú na generovanie inzerátov?',
    a: 'V základe Anthropic Claude Haiku 4.5 cez Vercel AI Gateway, s automatickým fallbackom na OpenAI GPT-5-mini. Žiadne dáta sa nepoužívajú na trénovanie — Vercel Gateway garantuje zero data retention.',
  },
  {
    q: 'Ako spĺňate GDPR a ochranu údajov?',
    a: 'Spracúvame iba účet zákazníka (e-mail, fakturačné údaje) a obchodné dáta vašich áut. Nikdy neukladáme osobné údaje predajcov z verejných inzerátov. Hostujeme v EÚ regiónoch (Frankfurt).',
  },
  {
    q: 'Mám API prístup pre integráciu s vlastným systémom?',
    a: 'Áno, v Premium pláne. REST API umožňuje načítať trhové snapshots, vytvárať watchlisty a generovať AI inzeráty programaticky. Dokumentácia a API kľúče sú v účte.',
  },
];

export function FAQ() {
  return (
    <section id="faq" className="border-border/40 border-t">
      <div className="container mx-auto px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-3xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Časté otázky</h2>
            <p className="text-muted-foreground mt-4 text-lg">
              Niečo, čo nie je v zozname? Napíšte nám na{' '}
              <a href="mailto:hello@cpcprofit.sk" className="text-primary hover:underline">
                hello@cpcprofit.sk
              </a>
              .
            </p>
          </div>

          <Accordion className="mt-12 w-full">
            {items.map((item, i) => (
              <AccordionItem key={i} value={`item-${i}`}>
                <AccordionTrigger className="text-left text-base font-medium">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-sm leading-relaxed">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
