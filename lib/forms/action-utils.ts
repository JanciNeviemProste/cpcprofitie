// Shared helpers for form server actions (garage, watchlist). `{ error: '' }`
// is the success sentinel — client forms treat a non-empty string as the
// Slovak error message to render.

export type ActionResult = { error: string } | void;

export function parseOptionalInt(
  raw: FormDataEntryValue | null,
  min: number,
  max: number,
): { value: number | null } | 'invalid' {
  const s = String(raw ?? '').trim();
  if (!s) return { value: null };
  const n = Number(s);
  if (!Number.isInteger(n) || n < min || n > max) return 'invalid';
  return { value: n };
}
