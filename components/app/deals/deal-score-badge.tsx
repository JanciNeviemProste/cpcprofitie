import { cn } from '@/lib/utils';

type Size = 'sm' | 'md' | 'lg';

function scoreGradient(score: number): string {
  if (score >= 90) return 'bg-gradient-to-br from-purple-500 to-pink-500 text-white';
  if (score >= 70) return 'bg-gradient-to-br from-emerald-500 to-cyan-500 text-white';
  if (score >= 40) return 'bg-amber-500 text-white';
  return 'bg-muted text-muted-foreground';
}

export function DealScoreBadge({
  score,
  size = 'md',
  className,
  showLabel = true,
}: {
  score: number;
  size?: Size;
  className?: string;
  showLabel?: boolean;
}) {
  const safe = Math.max(0, Math.min(100, Math.round(score)));
  const dims =
    size === 'lg'
      ? 'h-24 w-24 text-3xl'
      : size === 'sm'
        ? 'h-9 w-9 text-xs'
        : 'h-14 w-14 text-base';
  return (
    <div
      className={cn(
        'inline-flex flex-col items-center justify-center rounded-full font-bold tabular-nums shadow-md ring-2 ring-background/50',
        scoreGradient(safe),
        dims,
        className,
      )}
      aria-label={`Deal score ${safe} zo 100`}
    >
      <span className="leading-none">{safe}</span>
      {showLabel && size === 'lg' ? (
        <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wider opacity-90">
          Deal score
        </span>
      ) : null}
    </div>
  );
}

export { scoreGradient };
