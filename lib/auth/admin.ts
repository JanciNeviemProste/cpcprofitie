// Admin allowlist shared by the admin API routes and /app/admin pages.
// Empty or unset ADMIN_EMAILS means nobody is admin (fail closed).

export function parseAdminAllowlist(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowlist = parseAdminAllowlist();
  return allowlist.length > 0 && allowlist.includes(email.toLowerCase());
}
