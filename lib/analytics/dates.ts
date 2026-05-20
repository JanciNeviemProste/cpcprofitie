// Pure date helpers shared between snapshots compute and any UI that wants
// to align with the same ISO-week boundaries. No external deps — safe to
// import from anywhere including unit tests.

/** ISO week start (Monday 00:00:00 UTC) for the given date. */
export function isoWeekStart(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dow = d.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}
