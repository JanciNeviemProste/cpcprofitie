'use client';

import Link from 'next/link';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SortKey = 'newest' | 'oldest' | 'price-asc' | 'price-desc';

type Props = {
  /** Visible column label */
  label: string;
  /** Sort key when ascending */
  asc?: SortKey;
  /** Sort key when descending */
  desc?: SortKey;
  /** Currently applied sort */
  current: SortKey;
  /** Current search params (to preserve when toggling) */
  searchParams: Record<string, string | string[] | undefined>;
  /** Align content right (for numeric columns) */
  alignRight?: boolean;
};

function buildHref(
  next: SortKey,
  sp: Record<string, string | string[] | undefined>,
): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (k === 'sort' || k === 'page') continue;
    if (typeof v === 'string' && v !== '') p.set(k, v);
  }
  if (next !== 'newest') p.set('sort', next);
  const qs = p.toString();
  return `/app/listings/v4${qs ? `?${qs}` : ''}`;
}

export function SortHeader({
  label,
  asc,
  desc,
  current,
  searchParams,
  alignRight,
}: Props) {
  if (!asc && !desc) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1',
          alignRight && 'justify-end',
        )}
      >
        {label}
      </span>
    );
  }

  const isAsc = !!asc && current === asc;
  const isDesc = !!desc && current === desc;
  const isActive = isAsc || isDesc;

  // Toggle order: if current asc -> next desc; if current desc -> back to newest;
  // otherwise start with the column's "natural" direction (desc for numeric, asc for year).
  let next: SortKey;
  if (isAsc && desc) next = desc;
  else if (isDesc) next = 'newest';
  else next = desc ?? asc ?? 'newest';

  const Icon = isAsc ? ArrowUp : isDesc ? ArrowDown : ArrowUpDown;

  return (
    <Link
      href={buildHref(next, searchParams)}
      scroll={false}
      className={cn(
        'group/sort inline-flex items-center gap-1 transition-colors hover:text-foreground',
        isActive && 'text-foreground',
        alignRight && 'justify-end',
      )}
    >
      <span>{label}</span>
      <Icon
        className={cn(
          'size-3 transition-opacity',
          isActive ? 'opacity-100' : 'opacity-40 group-hover/sort:opacity-80',
        )}
      />
    </Link>
  );
}
