import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'Stránka nenájdená' };

export default function NotFound() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
      <div className="max-w-md text-center">
        <p className="text-primary text-sm font-semibold tracking-wider uppercase">404</p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">Stránka neexistuje</h1>
        <p className="text-muted-foreground mt-3 text-sm">
          Skontrolujte adresu alebo sa vráťte späť na úvod. Ak ste sem prišli z linku v našej
          aplikácii, dajte nám prosím vedieť.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button size="sm" render={<Link href="/" />}>
            Späť na úvod
          </Button>
          <Button variant="outline" size="sm" render={<Link href="/app/overview" />}>
            Otvoriť dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
