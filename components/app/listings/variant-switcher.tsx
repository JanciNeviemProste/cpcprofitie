import Link from 'next/link';

type Variant = 'v0' | 'v1' | 'v2' | 'v3' | 'v4';

const VARIANTS: { id: Variant; label: string; href: string; subtitle: string }[] = [
  { id: 'v0', label: 'v0', href: '/app/listings', subtitle: 'Klasická tabuľka' },
  { id: 'v1', label: 'v1', href: '/app/listings/v1', subtitle: 'Sleek dashboard' },
  { id: 'v2', label: 'v2', href: '/app/listings/v2', subtitle: 'Airbnb karty' },
  { id: 'v3', label: 'v3', href: '/app/listings/v3', subtitle: 'Editorial' },
  { id: 'v4', label: 'v4', href: '/app/listings/v4', subtitle: 'Pro trader' },
];

export function VariantSwitcher({ active }: { active: Variant }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-1.5 rounded-full border border-border/40 bg-card/30 p-1 text-xs backdrop-blur-sm">
      <span className="text-muted-foreground px-3 font-medium uppercase tracking-wider">
        Dizajn
      </span>
      {VARIANTS.map((v) => {
        const isActive = v.id === active;
        return (
          <Link
            key={v.id}
            href={v.href}
            className={
              'inline-flex items-baseline gap-1.5 rounded-full px-3 py-1.5 transition-colors ' +
              (isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground')
            }
          >
            <span className="font-semibold tabular-nums">{v.label}</span>
            <span className="hidden text-[10px] opacity-70 sm:inline">{v.subtitle}</span>
          </Link>
        );
      })}
    </div>
  );
}
