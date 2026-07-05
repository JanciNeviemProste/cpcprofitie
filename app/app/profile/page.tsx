import { LogOut } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/server';

export const metadata = { title: 'Profil' };

const LOCALES = [
  { value: 'sk', label: 'Slovenčina' },
  { value: 'cs', label: 'Čeština (čoskoro)' },
  { value: 'en', label: 'English (čoskoro)' },
];

const PROVIDER_LABELS: Record<string, string> = {
  email: 'E-mail a heslo',
  google: 'Google OAuth',
};

export default async function ProfilePage() {
  const user = await getCurrentUser();
  const provider = user?.app_metadata?.provider;
  const signInMethod = provider ? (PROVIDER_LABELS[provider] ?? provider) : '—';

  return (
    <div className="container mx-auto px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight">Profil</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Nastavenia účtu, jazyka a notifikácií.
        </p>

        <section className="border-border/40 bg-card/30 mt-8 rounded-xl border p-6">
          <h2 className="text-base font-semibold tracking-tight">Identita</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <Row label="E-mail" value={user?.email ?? 'neprihlásený (UI demo)'} />
            <Row label="ID účtu" value={user?.id ?? '—'} mono />
            <Row label="Spôsob prihlásenia" value={signInMethod} />
          </dl>
        </section>

        <section className="border-border/40 bg-card/30 mt-6 rounded-xl border p-6">
          <h2 className="text-base font-semibold tracking-tight">Jazyk rozhrania</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Aktuálne podporujeme slovenčinu. České a anglické rozhranie pridáme v budúcom kvartáli.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {LOCALES.map((loc) => (
              <button
                key={loc.value}
                type="button"
                disabled={loc.value !== 'sk'}
                className={
                  loc.value === 'sk'
                    ? 'border-primary bg-primary/10 text-primary rounded-lg border px-3 py-2 text-sm font-medium'
                    : 'border-border/60 text-muted-foreground rounded-lg border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50'
                }
              >
                {loc.label}
              </button>
            ))}
          </div>
        </section>

        <section className="border-border/40 bg-card/30 mt-6 rounded-xl border p-6">
          <h2 className="text-base font-semibold tracking-tight">Notifikácie</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            E-mail alerty a digest pripravujeme — nastavenia sprístupníme po ich spustení.
          </p>
          <div className="mt-4 space-y-3">
            <NotificationToggle
              label="Watchlist alerty (čoskoro)"
              description="E-mail keď sa objaví zhoda s vašimi kritériami"
            />
            <NotificationToggle
              label="Týždenný digest (čoskoro)"
              description="Súhrn pohybov v sledovaných modeloch každý pondelok"
            />
            <NotificationToggle
              label="Anomálie a trhový pulz (čoskoro)"
              description="Push pri neočakávaných cenových pohyboch (Premium)"
            />
          </div>
        </section>

        <section className="border-destructive/30 bg-destructive/5 mt-8 rounded-xl border p-6">
          <h2 className="text-destructive text-base font-semibold tracking-tight">Nebezpečná zóna</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Odhlásenie ukončí aktuálnu reláciu. Vaše dáta zostanú nedotknuté.
          </p>
          <form action="/auth/sign-out" method="post" className="mt-4">
            <button
              type="submit"
              className="border-destructive/40 text-destructive hover:bg-destructive/10 inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium"
            >
              <LogOut className="size-4" />
              Odhlásiť
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? 'font-mono text-xs' : ''}>{value}</dd>
    </div>
  );
}

// Notification delivery isn't built yet — render the planned options
// disabled so the UI doesn't pretend to save a preference it can't.
function NotificationToggle({ label, description }: { label: string; description: string }) {
  return (
    <label className="border-border/40 bg-background/30 flex items-start justify-between gap-4 rounded-lg border p-3 opacity-60">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
      <input
        type="checkbox"
        disabled
        className="mt-0.5 size-4 cursor-not-allowed accent-[var(--color-primary)]"
      />
    </label>
  );
}
