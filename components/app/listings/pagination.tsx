import Link from 'next/link';

type Props = {
  page: number;
  perPage: number;
  total: number;
  /** URL params to preserve when stepping between pages. */
  searchParams: Record<string, string | string[] | undefined>;
};

function buildHref(
  page: number,
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (k === 'page') continue;
    if (typeof v === 'string' && v !== '') sp.set(k, v);
  }
  if (page > 1) sp.set('page', String(page));
  const qs = sp.toString();
  return `/app/listings${qs ? `?${qs}` : ''}`;
}

export function Pagination({ page, perPage, total, searchParams }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const first = (safePage - 1) * perPage + 1;
  const last = Math.min(safePage * perPage, total);

  const prevHref = safePage > 1 ? buildHref(safePage - 1, searchParams) : null;
  const nextHref = safePage < totalPages ? buildHref(safePage + 1, searchParams) : null;

  return (
    <div className="border-border/60 bg-card/40 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm">
      <div className="text-muted-foreground">
        {total > 0
          ? `${first.toLocaleString('sk-SK')}–${last.toLocaleString('sk-SK')} z ${total.toLocaleString('sk-SK')}`
          : 'Žiadne inzeráty'}
      </div>
      <div className="flex items-center gap-2">
        {prevHref ? (
          <Link
            href={prevHref}
            className="border-border/60 hover:bg-muted rounded-md border px-3 py-1.5 text-sm"
          >
            ← Predošlá
          </Link>
        ) : (
          <span className="border-border/40 text-muted-foreground rounded-md border px-3 py-1.5 text-sm">
            ← Predošlá
          </span>
        )}
        <span className="text-muted-foreground tabular-nums">
          Strana {safePage.toLocaleString('sk-SK')} / {totalPages.toLocaleString('sk-SK')}
        </span>
        {nextHref ? (
          <Link
            href={nextHref}
            className="border-border/60 hover:bg-muted rounded-md border px-3 py-1.5 text-sm"
          >
            Ďalšia →
          </Link>
        ) : (
          <span className="border-border/40 text-muted-foreground rounded-md border px-3 py-1.5 text-sm">
            Ďalšia →
          </span>
        )}
      </div>
    </div>
  );
}
