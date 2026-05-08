'use client';

import { useState, useSyncExternalStore } from 'react';
import {
  CONSENT_STORAGE_KEY,
  defaultDeniedConsent,
  defaultGrantedConsent,
  parseConsent,
  type Consent,
} from '@/lib/consent';

function readConsent(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(CONSENT_STORAGE_KEY);
  } catch {
    return null;
  }
}

function subscribeConsent(onChange: () => void) {
  if (typeof window === 'undefined') return () => {};
  const handler = (e: StorageEvent) => {
    if (!e.key || e.key === CONSENT_STORAGE_KEY) onChange();
  };
  window.addEventListener('storage', handler);
  window.addEventListener('cpcprofit:consent-changed', onChange);
  return () => {
    window.removeEventListener('storage', handler);
    window.removeEventListener('cpcprofit:consent-changed', onChange);
  };
}

export function CookiesBanner() {
  const raw = useSyncExternalStore<string | null>(
    subscribeConsent,
    readConsent,
    () => null,
  );
  const consent = parseConsent(raw);
  const [showSettings, setShowSettings] = useState(false);
  const [analyticsDraft, setAnalyticsDraft] = useState(false);
  const [marketingDraft, setMarketingDraft] = useState(false);

  if (consent) return null;

  function persist(next: Consent) {
    try {
      localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(next));
      document.cookie = `cpcprofit_consent=${encodeURIComponent(
        JSON.stringify(next),
      )}; max-age=${60 * 60 * 24 * 365}; path=/; SameSite=Lax`;
      window.dispatchEvent(new Event('cpcprofit:consent-changed'));
    } catch {
      // Private browsing — silently dismiss; banner won't reappear this session.
      window.dispatchEvent(new Event('cpcprofit:consent-changed'));
    }
  }

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-3xl sm:inset-x-6">
      <div className="border-border/60 bg-card/95 rounded-2xl border p-5 shadow-2xl backdrop-blur-md">
        {!showSettings ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
            <div className="flex-1">
              <h2 className="text-sm font-semibold tracking-tight">Cookies a súkromie</h2>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                Používame nevyhnutné cookies pre prihlásenie a fungovanie platformy. Pre
                analytiku a personalizáciu marketingu si vyžadujeme Váš súhlas.{' '}
                <a href="/legal/privacy-policy" className="text-primary hover:underline">
                  Viac
                </a>
                .
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={() => persist(defaultDeniedConsent())}
                className="border-border/60 hover:bg-muted rounded-md border px-3 py-1.5 text-xs font-medium"
              >
                Iba nevyhnutné
              </button>
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                className="border-border/60 hover:bg-muted rounded-md border px-3 py-1.5 text-xs font-medium"
              >
                Nastaviť
              </button>
              <button
                type="button"
                onClick={() => persist(defaultGrantedConsent())}
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-3 py-1.5 text-xs font-medium"
              >
                Prijať všetko
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold tracking-tight">Detailné nastavenia</h2>
              <p className="text-muted-foreground mt-1 text-xs">
                Vyberte si, ktoré kategórie cookies povolíte.
              </p>
            </div>
            <ToggleRow label="Nevyhnutné" description="Prihlásenie, košík, jazyk" checked disabled />
            <ToggleRow
              label="Analytika"
              description="Anonymné metriky používania (Vercel Analytics)"
              checked={analyticsDraft}
              onChange={setAnalyticsDraft}
            />
            <ToggleRow
              label="Marketing"
              description="Personalizácia obsahu a remarketing"
              checked={marketingDraft}
              onChange={setMarketingDraft}
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="border-border/60 hover:bg-muted rounded-md border px-3 py-1.5 text-xs"
              >
                Späť
              </button>
              <button
                type="button"
                onClick={() =>
                  persist({
                    necessary: true,
                    analytics: analyticsDraft,
                    marketing: marketingDraft,
                    decidedAt: new Date().toISOString(),
                    version: 1,
                  })
                }
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-3 py-1.5 text-xs font-medium"
              >
                Uložiť výber
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (next: boolean) => void;
}) {
  return (
    <label className="border-border/40 bg-background/30 flex items-center justify-between gap-4 rounded-lg border p-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        className="size-4 cursor-pointer accent-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
      />
    </label>
  );
}
