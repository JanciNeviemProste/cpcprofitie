'use client';

import { useState } from 'react';
import { Copy, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Tone = 'formal' | 'sales' | 'short';

const TONE_OPTIONS: { value: Tone; label: string; description: string }[] = [
  { value: 'sales', label: 'Predajný', description: 'Energický, vyzdvihuje hodnotu' },
  { value: 'formal', label: 'Formálny', description: 'Vecný, vhodný pre fleet' },
  { value: 'short', label: 'Krátky', description: 'Iba fakty, do bullets' },
];

const FUEL_OPTIONS = ['Benzín', 'Diesel', 'Hybrid', 'Plug-in Hybrid', 'Elektro', 'LPG'];
const TRANSMISSION_OPTIONS = ['Manuálna', 'Automatická'];

type FormState = {
  make: string;
  model: string;
  year: string;
  mileageKm: string;
  fuel: string;
  transmission: string;
  features: string;
  priceEur: string;
  tone: Tone;
};

const INITIAL: FormState = {
  make: 'Škoda',
  model: 'Octavia',
  year: '2019',
  mileageKm: '120000',
  fuel: 'Diesel',
  transmission: 'Manuálna',
  features: 'Webasto, ťažné, originál servis, 2 sady kolies',
  priceEur: '14990',
  tone: 'sales',
};

export function AiListingForm() {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [mode, setMode] = useState<'live' | 'mock' | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function generate() {
    setError(null);
    setOutput('');
    setStreaming(true);
    try {
      const res = await fetch('/api/ai/listing', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      });
      setMode((res.headers.get('x-cpcprofit-mode') as 'live' | 'mock') ?? null);
      if (!res.ok || !res.body) {
        const text = await res.text();
        setError(`Chyba ${res.status}: ${text.slice(0, 200)}`);
        setStreaming(false);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setOutput(acc);
      }
      setStreaming(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Neznáma chyba');
      setStreaming(false);
    }
  }

  function copy() {
    void navigator.clipboard.writeText(output);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void generate();
        }}
        className="border-border/40 bg-card/30 space-y-4 rounded-xl border p-6"
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Značka">
            <input
              required
              value={form.make}
              onChange={(e) => update('make', e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Model">
            <input
              required
              value={form.model}
              onChange={(e) => update('model', e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Rok výroby">
            <input
              required
              type="number"
              min={1980}
              max={new Date().getFullYear() + 1}
              value={form.year}
              onChange={(e) => update('year', e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Najazdené (km)">
            <input
              required
              type="number"
              min={0}
              value={form.mileageKm}
              onChange={(e) => update('mileageKm', e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Palivo">
            <select
              value={form.fuel}
              onChange={(e) => update('fuel', e.target.value)}
              className="input"
            >
              <option value="">—</option>
              {FUEL_OPTIONS.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </Field>
          <Field label="Prevodovka">
            <select
              value={form.transmission}
              onChange={(e) => update('transmission', e.target.value)}
              className="input"
            >
              <option value="">—</option>
              {TRANSMISSION_OPTIONS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Výbava a poznámky">
          <textarea
            rows={3}
            value={form.features}
            onChange={(e) => update('features', e.target.value)}
            className="input min-h-20"
            placeholder="Servisná história, výbava, špeciálne vlastnosti…"
          />
        </Field>

        <Field label="Predajná cena (€) — voliteľná">
          <input
            type="number"
            min={0}
            value={form.priceEur}
            onChange={(e) => update('priceEur', e.target.value)}
            className="input"
          />
        </Field>

        <fieldset>
          <legend className="text-muted-foreground mb-2 block text-xs font-medium uppercase tracking-wider">
            Tonalita
          </legend>
          <div className="grid grid-cols-3 gap-2">
            {TONE_OPTIONS.map((opt) => {
              const active = form.tone === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => update('tone', opt.value)}
                  className={
                    active
                      ? 'border-primary bg-primary/10 text-primary rounded-lg border px-3 py-2 text-left text-xs'
                      : 'border-border/60 hover:bg-muted rounded-lg border px-3 py-2 text-left text-xs'
                  }
                >
                  <span className="block font-semibold">{opt.label}</span>
                  <span className="text-muted-foreground mt-0.5 block">{opt.description}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <Button type="submit" size="lg" className="w-full" disabled={streaming}>
          {streaming ? (
            <>
              <RefreshCw className="size-4 animate-spin" />
              Generujem…
            </>
          ) : (
            <>
              <Sparkles className="size-4" />
              Vygenerovať inzerát
            </>
          )}
        </Button>
      </form>

      <div className="border-border/40 bg-card/30 rounded-xl border p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight">Výstup</h2>
          <div className="flex items-center gap-2">
            {mode === 'mock' && (
              <span className="text-muted-foreground bg-muted rounded-md px-2 py-0.5 text-xs">
                Demo režim
              </span>
            )}
            {mode === 'live' && (
              <span className="bg-primary/15 text-primary rounded-md px-2 py-0.5 text-xs">
                Claude Haiku 4.5
              </span>
            )}
            {output && !streaming && (
              <button
                onClick={copy}
                className="border-border/60 hover:bg-muted inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs"
                type="button"
              >
                <Copy className="size-3" />
                Skopírovať
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive mt-4 rounded-lg p-3 text-sm">
            {error}
          </div>
        )}

        <div className="mt-4 min-h-72">
          {output ? (
            <pre className="text-foreground whitespace-pre-wrap font-sans text-sm leading-relaxed">
              {output}
              {streaming && <span className="bg-primary ml-1 inline-block h-4 w-1 animate-pulse" />}
            </pre>
          ) : (
            <p className="text-muted-foreground text-sm">
              Vyplňte parametre vľavo a kliknite „Vygenerovať“. Výstup sa bude streamovať tu.
            </p>
          )}
        </div>
      </div>
    </div>
  );
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
