# Contributing

Krátky sprievodca pre nový tím / kontraktora.

## Code style

- **Formatting**: Prettier (`pnpm format`). Nikdy neformátujte ručne — hooky a
  CI to spravia za vás.
- **Linting**: ESLint (`pnpm lint`) — v Next 16 platí
  `react-hooks/set-state-in-effect`; pre legitímne mount-detection patterns
  použite `useSyncExternalStore` (vzor v `components/theme-toggle.tsx`).
- **TypeScript**: strict mode, `tsc --noEmit` musí prejsť pred commitom.
- **Imports**: `@/` alias pre absolútne cesty z root projektu.
- **Komentáre**: píšeme **iba ak WHY nie je obvious**. Žiadne docstringy
  popisujúce čo funkcia robí (názov to už hovorí). Komentáre patria k
  netriviálnym invariantom, workaroundom a obmedzeniam SDK.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/):

- `feat(scope): ...` — nová funkcia
- `fix(scope): ...` — bugfix
- `chore(scope): ...` — tooling, deps, repo housekeeping
- `refactor(scope): ...` — bez zmeny správania
- `docs(scope): ...` — dokumentácia
- `test(scope): ...` — testy

Body commit message vysvetľuje **prečo** a **čo to umožňuje** — nie čo
mechanicky súbor robí.

Nikdy nepoužívajte `--no-verify` ani `--amend` na publikované commity.

## Branches

- `main` je production-tracking. Každý commit na `main` je deployovateľný.
- Feature branches: `feat/<short-name>`, otvárané z `main`.
- PR review: 1 approve + zelené CI (lint + typecheck + test).
- Squash & merge je default; rebase ak je commit history čistá.

## Test policy

- **`lib/`**: čisté funkcie majú mať vitest test (`*.test.ts` v
  `__tests__/`).
- **API routes**: zod-validovaný input + integration test s mockovaným
  externým providerom.
- **UI**: manual click-through pred PR; po launchi pridáme Playwright E2E
  pre signup → checkout → use feature flow.
- **Snapshot testy nie sú povolené** — ľahko sa stávajú technickým dlhom.

## Bezpečnostné guardrails

- Nikdy necommitujte `.env*` súbory (okrem `.env.example`).
- Nikdy nelogujte hodnoty z env premenných (logujte `process.env.X ? 'set' :
  'missing'`).
- Pri scrapingu rešpektujte ToS a robots.txt; všetky requesty s identifikujúcim
  User-Agent a crawl-delay 1.5s+.
- Neukladajte PII z verejných inzerátov (telefón, e-mail, meno predajcu).

## Lokálny dev na Windows

Repo môže žiť v OneDrive synchronizovanom adresári (vrátane sync warningu
"Slow filesystem"). Ak `pnpm dev` zlyháva s "Another next dev server is
already running. PID: <X>", spustite `taskkill //PID <X> //F`. **Nikdy**
`taskkill /F /IM node.exe` — to zabíja Claude Code, nielen dev server.

Detaily v memory files v
`~/.claude/projects/<projekt>/memory/project_workspace.md`.
