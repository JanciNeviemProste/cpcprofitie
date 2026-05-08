import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'Predplatné' };

const PLAN = {
  name: 'Free',
  status: 'Skúšobné obdobie',
  trialEndsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
  quotas: [
    { label: 'AI inzeráty', used: 0, limit: 3 },
    { label: 'Sledované modely', used: 0, limit: 1 },
    { label: 'Analýzy modelov', used: 2, limit: 3 },
  ],
};

export default function BillingPage() {
  return (
    <div className="container mx-auto px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Predplatné a fakturácia</h1>
        <p className="text-muted-foreground text-sm">
          Spravujte plán, históriu platieb a fakturačné údaje.
        </p>
      </div>

      <section className="border-border/40 bg-card/30 mt-8 rounded-xl border p-6">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wider">Aktuálny plán</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">{PLAN.name}</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {PLAN.status} · do {PLAN.trialEndsAt.toLocaleDateString('sk-SK')}
            </p>
          </div>
          <Button render={<Link href="/#pricing" />}>Upraviť plán</Button>
        </header>

        <div className="mt-6 grid gap-3">
          {PLAN.quotas.map((q) => {
            const pct = Math.min(100, (q.used / q.limit) * 100);
            return (
              <div key={q.label}>
                <div className="flex items-center justify-between text-sm">
                  <span>{q.label}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {q.used} / {q.limit}
                  </span>
                </div>
                <div className="bg-muted/40 mt-1.5 h-1.5 overflow-hidden rounded-full">
                  <div className="bg-primary h-full transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="border-border/40 bg-card/30 mt-6 rounded-xl border p-6">
        <h2 className="text-base font-semibold tracking-tight">Customer Portal</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Upravte spôsob platby, stiahnite faktúry alebo zrušte predplatné cez Stripe Customer
          Portal. Prístup sa aktivuje po prepojení Stripe účtu (Fáza 3).
        </p>
        <Button variant="outline" disabled className="mt-4">
          <ExternalLink className="size-4" />
          Otvoriť portal (čakáme na Stripe)
        </Button>
      </section>

      <section className="mt-6">
        <h2 className="text-base font-semibold tracking-tight">Čo dostanete v Plus / Premium</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Card title="Plus · €19 / mes">
            <li>Neobmedzené analýzy a porovnania</li>
            <li>50 AI inzerátov mesačne</li>
            <li>5 sledovaných modelov</li>
            <li>E-mail alerty (1 / deň)</li>
            <li>Garáž do 20 áut</li>
          </Card>
          <Card title="Premium · €49 / mes" highlight>
            <li>Všetko z Plus</li>
            <li>Neobmedzené AI inzeráty + watchlisty</li>
            <li>Real-time alerty (push + e-mail)</li>
            <li>Anomálie a trhový pulz</li>
            <li>API prístup</li>
          </Card>
        </div>
      </section>
    </div>
  );
}

function Card({
  title,
  highlight,
  children,
}: {
  title: string;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        highlight
          ? 'border-primary bg-card rounded-xl border-2 p-6'
          : 'border-border/40 bg-card/30 rounded-xl border p-6'
      }
    >
      <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      <ul className="mt-4 space-y-2 text-sm">
        {Array.isArray(children) ? null : null}
        {children}
      </ul>
    </div>
  );
}
