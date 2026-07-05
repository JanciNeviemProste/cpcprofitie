'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { addWatchlistEntryAction } from '@/app/app/watchlist/actions';
import type { ActionResult } from '@/lib/forms/action-utils';
import { SK_KRAJE } from '@/lib/data/sk-regions';
import type { ModelOption } from '@/lib/db/queries/models';

const FUEL_OPTIONS: { value: string; label: string }[] = [
  { value: 'gasoline', label: 'Benzín' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'phev', label: 'Plug-in hybrid' },
  { value: 'electric', label: 'Elektro' },
  { value: 'lpg', label: 'LPG' },
  { value: 'cng', label: 'CNG' },
  { value: 'other', label: 'Iné' },
];

export function AddWatchlistForm({
  models,
  atLimit,
  limitHint,
}: {
  models: ModelOption[];
  atLimit: boolean;
  limitHint: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(
    addWatchlistEntryAction,
    undefined,
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Success closes the panel via adjust-state-during-render (lint forbids
  // setState in effects); toast + reset are external effects keyed on
  // `state`, which is a fresh object per submit.
  const [prevState, setPrevState] = useState<ActionResult>(undefined);
  if (state !== prevState) {
    setPrevState(state);
    if (state != null && state.error === '') setOpen(false);
  }
  useEffect(() => {
    if (state != null && state.error === '') {
      toast.success('Sledovanie pridané.');
      formRef.current?.reset();
    }
  }, [state]);

  const makes = groupByMake(models);
  const noModels = models.length === 0;

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setOpen((v) => !v)}>
          {open ? <X className="size-4" /> : <Plus className="size-4" />}
          {open ? 'Zavrieť' : 'Pridať sledovanie'}
        </Button>
      </div>

      {open && (
        <section className="border-border/40 bg-card/30 mt-6 rounded-xl border p-5">
          {atLimit ? (
            <p className="text-sm">
              {limitHint}{' '}
              <Link href="/app/billing" className="text-primary underline underline-offset-2">
                Prejsť na Predplatné
              </Link>
            </p>
          ) : (
            <form ref={formRef} action={formAction} className="grid gap-3 sm:grid-cols-2">
              <Field label="Model (povinný)">
                <select name="modelId" required defaultValue="" disabled={noModels} className="input">
                  <option value="" disabled>
                    {noModels ? 'Žiadne modely (dáta sa ešte zbierajú)' : '— vyberte model —'}
                  </option>
                  {makes.map((m) => (
                    <optgroup key={m.makeName} label={m.makeName}>
                      {m.models.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </Field>
              <Field label="Kraj">
                <select name="region" defaultValue="" className="input">
                  <option value="">Všetky regióny</option>
                  {SK_KRAJE.map((k) => (
                    <option key={k.name} value={k.name}>
                      {k.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Palivo">
                <select name="fuel" defaultValue="" className="input">
                  <option value="">Ľubovoľné</option>
                  {FUEL_OPTIONS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Rok výroby od">
                <input name="minYear" type="number" min={1950} max={new Date().getFullYear() + 1} className="input" />
              </Field>
              <Field label="Cena od (€)">
                <input name="minPriceEur" type="number" min={0} max={2_000_000} className="input" />
              </Field>
              <Field label="Cena do (€)">
                <input name="maxPriceEur" type="number" min={0} max={2_000_000} className="input" />
              </Field>
              <Field label="Max. nájazd (km)">
                <input name="maxMileageKm" type="number" min={0} max={2_000_000} className="input" />
              </Field>

              <label className="flex items-center gap-2 self-end pb-1 text-sm">
                <input
                  type="checkbox"
                  name="notifyByEmail"
                  defaultChecked
                  className="size-4 accent-[var(--color-primary)]"
                />
                Posielať e-mail pri zhode
              </label>

              {state?.error ? (
                <p className="text-destructive text-sm sm:col-span-2">{state.error}</p>
              ) : null}

              <div className="sm:col-span-2">
                <Button type="submit" disabled={pending || noModels}>
                  {pending ? 'Ukladám…' : 'Uložiť sledovanie'}
                </Button>
              </div>
            </form>
          )}
        </section>
      )}
    </>
  );
}

function groupByMake(models: ModelOption[]): { makeName: string; models: ModelOption[] }[] {
  const map = new Map<string, ModelOption[]>();
  for (const m of models) {
    const arr = map.get(m.makeName) ?? [];
    arr.push(m);
    map.set(m.makeName, arr);
  }
  return [...map.entries()].map(([makeName, ms]) => ({ makeName, models: ms }));
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
        {label}
      </span>
      {children}
    </label>
  );
}
