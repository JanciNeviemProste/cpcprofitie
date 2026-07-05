'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { addGarageEntryAction } from '@/app/app/garage/actions';
import type { ActionResult } from '@/lib/forms/action-utils';
import type { ModelOption } from '@/lib/db/queries/models';

export function AddGarageForm({
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
    addGarageEntryAction,
    undefined,
  );
  const formRef = useRef<HTMLFormElement>(null);

  // `{ error: '' }` is the success signal from the action. Close the panel
  // via the adjust-state-during-render pattern (lint forbids setState in
  // effects); the toast + reset are external side effects keyed on `state`,
  // which is a fresh object per submit.
  const [prevState, setPrevState] = useState<ActionResult>(undefined);
  if (state !== prevState) {
    setPrevState(state);
    if (state != null && state.error === '') setOpen(false);
  }
  useEffect(() => {
    if (state != null && state.error === '') {
      toast.success('Vozidlo pridané do garáže.');
      formRef.current?.reset();
    }
  }, [state]);

  const makes = groupByMake(models);

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setOpen((v) => !v)}>
          {open ? <X className="size-4" /> : <Plus className="size-4" />}
          {open ? 'Zavrieť' : 'Pridať vozidlo'}
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
              <Field label="Model (z ponuky)">
                <select name="modelId" defaultValue="" className="input">
                  <option value="">— vlastné vozidlo —</option>
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
              <Field label="Vlastný názov (ak model nie je v ponuke)">
                <input name="label" maxLength={120} className="input" placeholder="napr. Octavia III 2.0 TDI" />
              </Field>
              <Field label="Rok výroby">
                <input name="year" type="number" min={1950} max={new Date().getFullYear() + 1} className="input" />
              </Field>
              <Field label="Nájazd (km)">
                <input name="mileageKm" type="number" min={0} max={2_000_000} className="input" />
              </Field>
              <Field label="Nákupná cena (€)">
                <input name="purchasePriceEur" type="number" min={0} max={2_000_000} className="input" />
              </Field>
              <Field label="Cieľová marža (€)">
                <input name="targetMarginEur" type="number" min={0} max={2_000_000} className="input" />
              </Field>
              <Field label="VIN (voliteľné)">
                <input name="vin" maxLength={17} className="input" placeholder="17 znakov" />
              </Field>
              <Field label="Poznámka">
                <input name="notes" maxLength={2000} className="input" />
              </Field>

              {state?.error ? (
                <p className="text-destructive text-sm sm:col-span-2">{state.error}</p>
              ) : null}

              <div className="sm:col-span-2">
                <Button type="submit" disabled={pending}>
                  {pending ? 'Ukladám…' : 'Uložiť vozidlo'}
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
