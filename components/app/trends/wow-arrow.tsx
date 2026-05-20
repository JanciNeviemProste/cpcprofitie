import { ArrowDown, ArrowUp, Minus } from 'lucide-react';

/** Week-over-week diff arrow + percent. Greenforup, red for down (demand context). */
export function WowArrow({
  current,
  previous,
  invert = false,
}: {
  current: number | null;
  previous: number | null;
  /** If true (e.g. price drops are good), red↔green meanings swap. */
  invert?: boolean;
}) {
  if (current == null || previous == null || previous === 0) {
    return <span className="text-muted-foreground/60 text-xs">—</span>;
  }
  const diff = current - previous;
  const pct = (diff / previous) * 100;
  if (Math.abs(pct) < 0.5) {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-0.5 text-xs">
        <Minus className="size-3" />
      </span>
    );
  }
  const up = diff > 0;
  const positive = invert ? !up : up;
  const color = positive ? 'text-emerald-500' : 'text-rose-500';
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <span className={`${color} inline-flex items-center gap-0.5 text-xs font-medium`}>
      <Icon className="size-3" />
      {Math.abs(pct).toFixed(0)}%
    </span>
  );
}
