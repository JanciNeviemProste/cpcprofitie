'use client';

import { useState } from 'react';

export function PhotoGallery({ photos }: { photos: string[] }) {
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);

  if (photos.length === 0) {
    return (
      <div className="border-border/40 bg-muted aspect-[4/3] w-full rounded-lg border" />
    );
  }

  const hero = photos[active] ?? photos[0]!;

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border-border/40 block aspect-[4/3] w-full overflow-hidden rounded-lg border"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={hero}
          alt=""
          loading="eager"
          className="h-full w-full object-cover transition-transform duration-200 hover:scale-105"
        />
      </button>
      {photos.length > 1 && (
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-10">
          {photos.slice(0, 24).map((src, i) => (
            <button
              key={src + i}
              type="button"
              onClick={() => setActive(i)}
              className={
                i === active
                  ? 'ring-primary border-border/40 aspect-[4/3] overflow-hidden rounded border ring-2'
                  : 'border-border/40 aspect-[4/3] overflow-hidden rounded border opacity-80 transition-opacity hover:opacity-100'
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
      {open && (
        <div
          className="bg-background/95 fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur"
          onClick={() => setOpen(false)}
        >
          <div className="relative max-h-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={hero} alt="" className="max-h-[90vh] max-w-full rounded-lg" />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="border-border/60 bg-background hover:bg-muted absolute top-2 right-2 rounded-md border px-3 py-1 text-sm"
            >
              Zavrieť
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
