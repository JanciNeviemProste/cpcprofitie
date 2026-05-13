'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { Source } from '@/lib/scraping/types';

type Props = {
  sources: { source: Source; count: number }[];
};

const SORT_OPTIONS = [
  { value: 'newest', label: 'Najnovšie' },
  { value: 'oldest', label: 'Najstaršie' },
  { value: 'price-asc', label: 'Cena ↑' },
  { value: 'price-desc', label: 'Cena ↓' },
];

export function ListingsFilterBar({ sources }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(sp.get('q') ?? '');

  function push(next: URLSearchParams) {
    next.delete('page'); // reset paging on any filter change
    startTransition(() => router.push(`/app/listings?${next.toString()}`));
  }

  function onSourceChange(value: string) {
    const next = new URLSearchParams(sp);
    if (value) next.set('source', value);
    else next.delete('source');
    push(next);
  }

  function onSortChange(value: string) {
    const next = new URLSearchParams(sp);
    if (value && value !== 'newest') next.set('sort', value);
    else next.delete('sort');
    push(next);
  }

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams(sp);
    if (q.trim()) next.set('q', q.trim());
    else next.delete('q');
    push(next);
  }

  function clear() {
    setQ('');
    push(new URLSearchParams());
  }

  const currentSource = sp.get('source') ?? '';
  const currentSort = sp.get('sort') ?? 'newest';
  const anyActive = sp.has('source') || sp.has('q') || sp.has('sort');

  return (
    <form
      onSubmit={onSearchSubmit}
      className="border-border/60 bg-card/40 flex flex-wrap items-end gap-3 rounded-lg border p-3"
    >
      <div className="flex flex-col gap-1">
        <label className="text-muted-foreground text-xs">Hľadať</label>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="napr. Octavia"
          className="border-border/60 bg-background h-9 w-48 rounded-md border px-3 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-muted-foreground text-xs">Zdroj</label>
        <select
          value={currentSource}
          onChange={(e) => onSourceChange(e.target.value)}
          className="border-border/60 bg-background h-9 rounded-md border px-2 text-sm"
        >
          <option value="">Všetky zdroje</option>
          {sources.map((s) => (
            <option key={s.source} value={s.source}>
              {s.source} ({s.count.toLocaleString('sk-SK')})
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-muted-foreground text-xs">Zoradiť</label>
        <select
          value={currentSort}
          onChange={(e) => onSortChange(e.target.value)}
          className="border-border/60 bg-background h-9 rounded-md border px-2 text-sm"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        className="bg-primary text-primary-foreground hover:bg-primary/90 h-9 rounded-md px-4 text-sm font-medium"
        disabled={pending}
      >
        Filtrovať
      </button>
      {anyActive && (
        <button
          type="button"
          onClick={clear}
          className="text-muted-foreground hover:text-foreground h-9 rounded-md px-3 text-sm"
        >
          Zrušiť
        </button>
      )}
    </form>
  );
}
