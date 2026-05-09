# Operations runbook — CPCProfit

Krátke playbooky pre incidenty a rutinnú údržbu. Pridaj kontakt
zodpovedného člena tímu pre každú sekciu.

## Health monitoring

- **Endpoint**: `GET https://cpcprofit.sk/api/health`
- **Statusy**: `ok` (HTTP 200), `degraded` (200 + missingOptional), `error` (503 + missingRequired)
- **Uptime monitor**: nastav externe (BetterStack, UptimeRobot) na 5-min interval, alert pri 2 po sebe nasledujúcich `503` alebo timeout.

## Sentry alerts (odporúčané rules)

V Sentry projekte → Alerts:

1. **Error rate spike** — > 10 unique errors / 5 min → Slack #incidents
2. **New issue** v auth/* alebo api/stripe/webhook → e-mail on-call ihneď
3. **Performance regression** — p95 transaction duration na `/app/overview` > 3s pre 10 min → Slack #engineering

## Incidenty

### Auth flow zlyháva (užívatelia sa nevedia prihlásiť)

**Symptómy**: 5xx na `/auth/callback`, Sentry errors `auth_exchange_failed`,
`/api/health` reportuje `supabase: false`.

1. `curl -s https://cpcprofit.sk/api/health | jq` — over checks.
2. Vercel Dashboard → Logs → filter `proxy.ts` alebo `/auth/callback` za posledných 30 min.
3. Supabase Dashboard → Authentication → Logs — chyby OAuth providera?
4. Skontroluj že Google OAuth client ID/Secret platné, redirect URI správne.
5. **Mitigation**: ak Supabase je down, fail-closed proxy už zobrazí
   `/login?error=auth_unavailable`. Communikuj na status page.

### AI quota burn / nečakané náklady

**Symptómy**: AI Gateway billing alert, Anthropic dashboard ukazuje vysoký
token consumption.

1. Vercel Dashboard → Functions → `/api/ai/listing` → Last 1h logs.
2. Filter pre suspicious patterns (rovnaký IP, opakované requesty).
3. Skontroluj `users` count vs AI listings vygenerované cez `events` table:
   ```sql
   SELECT user_id, COUNT(*) FROM ai_listings
   WHERE created_at > now() - interval '1 hour'
   GROUP BY user_id ORDER BY count DESC LIMIT 10;
   ```
4. **Mitigation**:
   - Dočasne zníž per-user limit v `app/api/ai/listing/route.ts` (`limit: 30 → 10`).
   - Zablokuj abuser cez `users.role = 'banned'` (po pridaní enum value).
   - Najhorší scenár: `vercel env rm AI_GATEWAY_API_KEY` → flow fallback na mock.

### Scraper zablokovaný (autobazar.sk vracia 403/429)

**Symptómy**: `/api/scrape/autobazar` vracia 502, `scrape_runs` table
ukazuje `errorMessage: "page X: HTTP 429"`, žiadne nové `listings`.

1. Vercel Dashboard → Functions → cron logs.
2. Lokálne over: `pnpm tsx scripts/scrape-autobazar.ts 1`.
3. Skontroluj `https://www.autobazar.sk/robots.txt` — zmena Disallow?
4. **Mitigation eskalácia**:
   - Krok 1: zvýš `delayMs` na 5000 v `scrapeAutobazarSk` options.
   - Krok 2: rotuj UA (zachovaj identifikáciu botu, zmeň verziu).
   - Krok 3: prepni na Apify alebo Bright Data residential proxy
     (vyžaduje rozpočet).
   - Krok 4: pre právny problém, **STOP scraping**, kontaktuj autobazar.sk
     business team.

### Stripe webhook nedoručené

**Symptómy**: Užívateľ zaplatil, ale `subscriptions` row chýba alebo má
starý `status`.

1. Stripe Dashboard → Developers → Webhooks → tvoj endpoint → **Recent
   deliveries**.
2. Filter Failed → klikni → check response body / status.
3. Ak signature verification failed: skontroluj `STRIPE_WEBHOOK_SECRET` v
   Vercel env match Stripe webhook secret.
4. Ak handler 5xx: Vercel logs pre `/api/stripe/webhook` → ` stripe_webhook_handler_failed`.
5. **Manual recovery**:
   - Stripe Dashboard → Recent delivery → **Resend** (alebo CLI
     `stripe events resend evt_...`).
   - Alebo manuálne upsert subscription row z dat zo Stripe Dashboard.

### Cookies banner nezmizne po výbere

**Symptómy**: User report, `localStorage.cpcprofit-consent` neexistuje.

1. Otvor browser DevTools → Application → Local Storage → over kľúč.
2. Ak chýba: pravdepodobne private browsing / blocked storage. Banner sa
   v tomto prípade aj tak schová pri Persist (graceful fallback).
3. Ak je v iných browseroch OK: skontroluj CSP — či `'self'` storage je
   povolené. CSP je vo `next.config.ts`.

## Routine maintenance

### Týždenne

- [ ] Prejdi Sentry Issues → archivuj resolved, triage nové.
- [ ] Vercel Analytics → over Core Web Vitals trendy (`/`, `/app/overview`).
- [ ] Stripe Dashboard → Failed payments — kontaktuj zákazníkov osobne.

### Mesačne

- [ ] `pnpm outdated` → upgradni minor verzie deps.
- [ ] Lighthouse audit produkčného `/` — over že skóre nepoklesli.
- [ ] Backup over Supabase → Database → Backups (automatické denné, over
      retention).
- [ ] Rotuj `CRON_SECRET` (`openssl rand -hex 32`, update v Vercel env,
      redeploy).

### Kvartálne

- [ ] `pnpm update next@latest` — major upgrade s migration testom na
      preview.
- [ ] Penetration test (interný alebo external) — najmä `/api/stripe/*`,
      `/auth/*`.
- [ ] Cost review: AI Gateway, Stripe, Vercel, Supabase — porovnaj s
      revenue per plan.

## On-call rotácia (template)

| Týždeň | Primary | Secondary |
|---|---|---|
| W1 | TBD | TBD |
| W2 | TBD | TBD |

**Hand-off**: každý piatok 17:00, krátke 15-min sync — open issues, posledný
deploy, plánované kroky budúci týždeň.

## Eskalácia

| Severity | Response time | Action |
|---|---|---|
| **SEV-1** (data loss, auth completely down) | 15 min | All-hands, status page, customer comm |
| **SEV-2** (major feature broken pre > 25 % users) | 1 h | On-call + secondary, post-mortem do 48h |
| **SEV-3** (minor regression, single feature) | 4 h | On-call only, fix v ďalšom sprint |
| **SEV-4** (cosmetic, edge case) | best effort | Backlog |

Status page: TBD (`status.cpcprofit.sk` cez StatusPage.io alebo Better
Stack).
