export function ConfidenceBadge({ level }: { level: 'low' | 'medium' | 'high' }) {
  const styles = {
    high: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    medium: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
    low: 'bg-muted text-muted-foreground border-border/60',
  };
  const label = { high: 'Vysoká', medium: 'Stredná', low: 'Nízka' }[level];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${styles[level]}`}
    >
      {label}
    </span>
  );
}
