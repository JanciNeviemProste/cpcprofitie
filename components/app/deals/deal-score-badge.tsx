import { cn } from '@/lib/utils';

type Size = 'sm' | 'md' | 'lg';

// Tier semantics drive both the arc colour and the small text label below it.
// 90+ Exceptional, 80+ Strong, 70+ Solid, 40+ Watch, else Pass.
function tier(score: number): { label: string; tone: 'elite' | 'strong' | 'solid' | 'watch' | 'pass' } {
  if (score >= 90) return { label: 'Excepčný', tone: 'elite' };
  if (score >= 80) return { label: 'Silný', tone: 'strong' };
  if (score >= 70) return { label: 'Solídny', tone: 'solid' };
  if (score >= 40) return { label: 'Sleduj', tone: 'watch' };
  return { label: 'Pass', tone: 'pass' };
}

function arcStroke(tone: 'elite' | 'strong' | 'solid' | 'watch' | 'pass'): string {
  switch (tone) {
    case 'elite':
      return 'stroke-emerald-400';
    case 'strong':
      return 'stroke-emerald-500';
    case 'solid':
      return 'stroke-emerald-600/80';
    case 'watch':
      return 'stroke-amber-500/80';
    default:
      return 'stroke-muted-foreground/50';
  }
}

// Legacy gradient export kept for any third-party callers. Returns a neutral
// monochrome class set; the new design no longer uses purple/cyan gradients.
function scoreGradient(score: number): string {
  if (score >= 80) return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300';
  if (score >= 70) return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
  if (score >= 40) return 'bg-amber-500/15 text-amber-700 dark:text-amber-300';
  return 'bg-muted text-muted-foreground';
}

const SIZE_MAP: Record<Size, { box: number; stroke: number; num: string; label: string }> = {
  sm: { box: 40, stroke: 3, num: 'text-[11px]', label: 'text-[8px]' },
  md: { box: 60, stroke: 4, num: 'text-base', label: 'text-[9px]' },
  lg: { box: 104, stroke: 6, num: 'text-3xl', label: 'text-[10px]' },
};

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
  const { label, tone } = tier(safe);
  const cfg = SIZE_MAP[size];
  const r = (cfg.box - cfg.stroke) / 2;
  const c = 2 * Math.PI * r;
  // Arc starts at the bottom-left and sweeps clockwise around to bottom-right.
  // We use a 270deg arc (3/4 turn) so the visualization feels like a gauge
  // rather than a full ring — more "instrument" than "progress wheel".
  const arcSpan = 0.75; // proportion of the circumference used by the gauge
  const dash = (safe / 100) * c * arcSpan;
  const dashArray = `${dash} ${c}`;

  return (
    <div
      className={cn('relative inline-flex flex-col items-center', className)}
      aria-label={`DealScore ${safe} zo 100, ${label}`}
    >
      <div className="relative" style={{ width: cfg.box, height: cfg.box }}>
        <svg
          viewBox={`0 0 ${cfg.box} ${cfg.box}`}
          className="h-full w-full -rotate-[135deg]"
          aria-hidden
        >
          {/* Track */}
          <circle
            cx={cfg.box / 2}
            cy={cfg.box / 2}
            r={r}
            fill="none"
            strokeWidth={cfg.stroke}
            strokeLinecap="round"
            className="stroke-foreground/10"
            strokeDasharray={`${c * arcSpan} ${c}`}
          />
          {/* Active arc */}
          <circle
            cx={cfg.box / 2}
            cy={cfg.box / 2}
            r={r}
            fill="none"
            strokeWidth={cfg.stroke}
            strokeLinecap="round"
            className={cn('transition-[stroke-dasharray] duration-700 ease-out', arcStroke(tone))}
            strokeDasharray={dashArray}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={cn(
              'font-mono font-semibold leading-none tabular-nums',
              cfg.num,
              tone === 'pass' ? 'text-muted-foreground' : 'text-foreground',
            )}
          >
            {safe}
          </span>
          {showLabel && size !== 'sm' ? (
            <span
              className={cn(
                'mt-0.5 font-medium uppercase tracking-[0.14em] text-muted-foreground',
                cfg.label,
              )}
            >
              {label}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export { scoreGradient };
