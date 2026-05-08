import { SiteFooter } from '@/components/marketing/site-footer';
import { SiteHeader } from '@/components/marketing/site-header';

export const metadata = {
  title: 'Ochrana osobných údajov',
};

const LAST_UPDATED = '2026-05-08';

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <article className="container mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
          <header>
            <h1 className="text-4xl font-bold tracking-tight">Ochrana osobných údajov</h1>
            <p className="text-muted-foreground mt-2 text-sm">
              Posledná aktualizácia: {LAST_UPDATED}
            </p>
            <div className="bg-muted/30 text-muted-foreground mt-6 rounded-lg border p-3 text-xs">
              Tento dokument je <strong>návrh pred právnym preskúmaním</strong> v zmysle GDPR
              (Nariadenie EÚ 2016/679) a zákona 18/2018 Z. z. Pred GA ho schváli právny
              poradca.
            </div>
          </header>

          <div className="prose prose-invert mt-10 space-y-8 text-sm leading-relaxed">
            <Section title="1. Prevádzkovateľ">
              <p>
                Prevádzkovateľom v zmysle GDPR je spoločnosť prevádzkujúca platformu CPCProfit.
                Kontakt pre otázky ohľadom súkromia:{' '}
                <a href="mailto:privacy@cpcprofit.sk" className="text-primary hover:underline">
                  privacy@cpcprofit.sk
                </a>
                .
              </p>
            </Section>

            <Section title="2. Aké údaje spracúvame">
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <strong>Účet:</strong> e-mail, meno (z Google OAuth profilu), avatar URL,
                  jazyk, časová zóna.
                </li>
                <li>
                  <strong>Fakturácia:</strong> spracovávaná Stripe Payments Europe Ltd. — my
                  ukladáme iba ID zákazníka a stav predplatného.
                </li>
                <li>
                  <strong>Obchodné dáta Užívateľa:</strong> vozidlá v Garáži, sledované modely
                  (Watchlist), AI generované texty inzerátov.
                </li>
                <li>
                  <strong>Telemetria:</strong> anonymizované metriky používania (Vercel
                  Analytics) — iba ak Užívateľ povolil v cookies banneri.
                </li>
                <li>
                  <strong>Chybové stopy:</strong> Sentry Error Tracking — bez osobných údajov.
                </li>
              </ul>
            </Section>

            <Section title="3. Verejné inzeráty z autobazárov">
              <p>
                Z verejne dostupných stránok (autobazar.sk a ďalšie) agregujeme{' '}
                <strong>iba anonymizované metaúdaje</strong> o vozidlách: značka, model, rok
                výroby, najazdené kilometre, palivo, prevodovka, predajná cena, región, URL
                inzerátu. <strong>Telefónne čísla, e-mailové adresy ani mená predajcov nikdy
                neukladáme</strong> a nespájame s identitou predajcov.
              </p>
            </Section>

            <Section title="4. Právny základ a účel">
              <p>
                Spracúvame údaje na základe <strong>plnenia zmluvy</strong> (čl. 6 ods. 1 b
                GDPR — poskytovanie platformy), <strong>oprávneného záujmu</strong> (čl. 6 ods.
                1 f — bezpečnosť a prevencia podvodov) a v prípade marketingu na základe
                <strong> súhlasu</strong> (čl. 6 ods. 1 a).
              </p>
            </Section>

            <Section title="5. Doba uchovávania">
              <p>
                Údaje účtu uchovávame počas trvania zmluvy a 12 mesiacov po jej ukončení.
                Fakturačné údaje 10 rokov v zmysle účtovných predpisov. Anonymizované trhové
                dáta uchovávame neobmedzene pre historickú analýzu.
              </p>
            </Section>

            <Section title="6. Príjemcovia údajov">
              <ul className="list-disc space-y-1 pl-5">
                <li>Vercel Inc. (hosting, EÚ regióny — Frankfurt)</li>
                <li>Supabase (databáza a autentifikácia, EÚ región)</li>
                <li>Stripe Payments Europe Ltd. (platby, Írsko)</li>
                <li>Resend (transakčné e-maily, EÚ región)</li>
                <li>Anthropic (cez Vercel AI Gateway, zero data retention)</li>
                <li>Sentry (error tracking, EÚ región)</li>
              </ul>
            </Section>

            <Section title="7. Vaše práva">
              <p>
                Máte právo na prístup k údajom, ich opravu, vymazanie, obmedzenie spracúvania,
                prenos a podanie sťažnosti dozornému orgánu (Úrad na ochranu osobných údajov SR).
                Žiadosti smerujte na{' '}
                <a href="mailto:privacy@cpcprofit.sk" className="text-primary hover:underline">
                  privacy@cpcprofit.sk
                </a>{' '}
                — odpoveď do 30 dní.
              </p>
            </Section>

            <Section title="8. Cookies">
              <p>
                Nevyhnutné cookies (prihlásenie, jazyk) sú aktívne automaticky. Analytické a
                marketingové cookies sa zapnú iba s Vašim výslovným súhlasom v banneri pri prvej
                návšteve — výber môžete kedykoľvek zmeniť cez nastavenia účtu.
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
