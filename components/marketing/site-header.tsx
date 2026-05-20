import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';

const navLinks = [
  { href: '/#features', label: 'Funkcie' },
  { href: '/#pricing', label: 'Cenník' },
  { href: '/#faq', label: 'FAQ' },
];

export function SiteHeader() {
  return (
    <header className="border-border/40 bg-background/80 sticky top-0 z-50 w-full border-b backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="from-primary to-chart-2 flex size-8 items-center justify-center rounded-lg bg-gradient-to-br text-sm font-bold text-white">
            C
          </span>
          <span className="text-base font-semibold tracking-tight">CPCProfit</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle className="hidden sm:inline-flex" />
          <Link
            href="/login"
            className="text-muted-foreground hover:text-foreground hidden text-sm font-medium transition-colors sm:block"
          >
            Prihlásiť sa
          </Link>
          <Button size="sm" render={<Link href="/register" />}>
            Vyskúšať zadarmo
          </Button>
        </div>
      </div>
    </header>
  );
}
