// Cookie consent state — kept tiny so it can be read from both server (cookie
// header) and client (localStorage). The same shape is written by the
// CookiesBanner component once the user makes a choice.

export type ConsentChoice = 'necessary' | 'analytics' | 'marketing';

export type Consent = {
  necessary: true; // always granted — required for the app to function
  analytics: boolean;
  marketing: boolean;
  decidedAt: string; // ISO timestamp
  version: 1;
};

export const CONSENT_STORAGE_KEY = 'cpcprofit-consent';
export const CONSENT_COOKIE_NAME = 'cpcprofit_consent';

export function defaultDeniedConsent(): Consent {
  return {
    necessary: true,
    analytics: false,
    marketing: false,
    decidedAt: new Date().toISOString(),
    version: 1,
  };
}

export function defaultGrantedConsent(): Consent {
  return {
    necessary: true,
    analytics: true,
    marketing: true,
    decidedAt: new Date().toISOString(),
    version: 1,
  };
}

export function parseConsent(raw: string | null | undefined): Consent | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Consent>;
    if (parsed && parsed.version === 1 && typeof parsed.decidedAt === 'string') {
      return {
        necessary: true,
        analytics: Boolean(parsed.analytics),
        marketing: Boolean(parsed.marketing),
        decidedAt: parsed.decidedAt,
        version: 1,
      };
    }
  } catch {
    // ignore malformed value
  }
  return null;
}
