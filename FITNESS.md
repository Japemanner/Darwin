# FITNESS.md — Architecture Fitness Log

_Maintained automatically by the `@fitness-checker` agent._  
_Do not edit manually._

---

<!-- Fitness check entries will be appended here after each feature -->

---

## Feature 010 — Beheerfuncties alleen voor beheerders (PR #19) — 2026-10-16

**Uitgevoerd**: `bash scripts/fitness-check.sh` + pre-commit gates + Playwright + F-01/F-10 verificatiepoging via Supabase Management API + Snyk CLI-poging.

### scripts/fitness-check.sh

| Resultaat | FAIL:0 — PASS:12 / WARN:2 / SKIP:4 |
|---|---|

- F-14 WARN: 1 directe DOM-call in `src/main.tsx:5` — intentioneel (React root mount).
- F-15 WARN: 1 van de laatste 5 commits niet-conventioneel — de merge-commit van PR #16.
- F-01/F-10/F-16/F-17: SKIP (delegatie naar MCP/externe tools — zie hieronder).

### Overige gates

- `npx tsc --noEmit`: 0 fouten — F-07 groen.
- `npm run build`: groen (7.5s, 0 fouten; chunk-size waarschuwing pre-existing).
- `npx eslint src/`: 0 errors / 6 pre-existing warnings (App.tsx 1x exhaustive-deps; toast.tsx/posthog.tsx 5x react-refresh) — pre-commit hook behandelt ESLint als non-blocking (bekende afwijking, zie `knowledge/tooling/knowledge.md`); geen van de warnings is ontstaan in feature 010.
- Gitleaks (pre-commit, `detect --no-git`): geen secrets.
- Playwright volledige suite: **47 skipped / 0 failed** — alle specs gebruiken echte Supabase-login (`tests/e2e/fixtures.ts`); vereist `E2E_EMAIL`/`E2E_PASSWORD` + `E2E_MEMBER_EMAIL`/`E2E_MEMBER_PASSWORD` in `.env.local` (nog aan te maken, quickstart §1).

### MCP-gestuurde checks (F-01/F-10/F-16/F-17)

- **F-01 RLS-enabled / F-10 bucket-policies: geblokkeerd** — `SUPABASE_ACCESS_TOKEN` in `.env.local` geeft 401 Unauthorized op de Supabase Management API (`/v1/projects/{ref}/database/query`). Token verlopen — hernieuwen vóór de verificatie (quickstart §4 SQL + rls-verify).
- **F-16 Snyk SAST / F-17 Snyk SCA: geblokkeerd** — Snyk CLI met `SNYK_API_KEY` uit `.env.local` geeft 401 (SNYK-0005, "user access is not provisioned"). Snyk MCP niet actief in deze sessie.

### Verdict

**SHIP met verificatieachterstand**: alle lokale gates groen; migratie 015 is op productie toegepast (door Jaap, vóór de frontend-deploy — zie `decisions/2026-10-16-010-migratie-voor-frontend-deploy.md`). Nog te verifiëren zodra middelen beschikbaar zijn (zie Gap in FEATURES.md, feature 010):

1. `node scripts/rls-verify.mjs` → 15 schrijfweigeringen + storage PASS (SC-001/SC-002) — vereist member-testaccount.
2. SQL-controles quickstart §4 (pg_policies "Admins can …" + `is_org_admin()`) — vereist geldige SUPABASE_ACCESS_TOKEN.
3. E2e-regressiesuite echt draaien (admin + member) — vereist E2E-credentials.
4. F-01/F-10 via Supabase MCP en F-16/F-17 via Snyk MCP.

---

## Feature 011 — Chat als eigen pagina met hervatbare gesprekken — 2026-10-19

**Uitgevoerd**: `bash scripts/fitness-check.sh` + overige lokale gates (tsc draait mee als F-07 in het script).

### scripts/fitness-check.sh

| Resultaat | FAIL:0 — PASS:13 / WARN:1 / SKIP:4 |
|---|---|

- F-14 WARN: 1 directe DOM-call in `src/main.tsx:5` — intentioneel (React root mount), pre-existing.
- F-15 PASS: laatste 5 commits conventioneel (de PR-#16-merge-warn uit feature 010 is uit het venster verdwenen).
- F-01/F-10/F-16/F-17: SKIP (delegatie naar Supabase/Snyk MCP — niet actief in deze sessie, zie hieronder).

### Overige gates

- `npm run build`: groen (22.6s; chunk-size waarschuwing pre-existing).
- `npx eslint src/`: 0 errors / 6 pre-existing warnings — zelfde set als feature 010 (App.tsx 1x exhaustive-deps; toast.tsx/posthog.tsx 5x react-refresh); pre-commit hook behandelt ESLint als non-blocking (bekende afwijking, zie `knowledge/tooling/knowledge.md`); geen nieuwe warnings uit feature 011.
- Playwright volledige suite: **51 skipped / 0 failed** — 4 nieuwe chat-page-tests erbij (47→51); alle specs vereisen echte Supabase-login (`tests/e2e/fixtures.ts`) met `E2E_EMAIL`/`E2E_PASSWORD` (+ member-variant) in `.env.local` — nog aan te vullen (quickstart §1).

### MCP-gestuurde checks (F-01/F-10/F-16/F-17)

- Supabase MCP en Snyk MCP niet actief in deze sessie — F-01/F-10/F-16/F-17 blijven open; zelfde achterstand als bij feature 010 (SUPABASE_ACCESS_TOKEN en SNYK_API_KEY gaven daar 401).

### Verdict

**SHIP met verificatieachterstand**: alle lokale gates groen (FAIL:0, blocking:0). Uitrol van migratie 016 + `rag-chat` v2 + frontend-release gebeurt handmatig door Jaap via `specs/011-resumable-chat-page/quickstart.md` §3-§5 (na code-review), inclusief titel-SQL-check (T025). De openstaande verificatie-achterstand van feature 010 (rls-verify, SQL-controles, e2e met echte accounts) blijft ongewijzigd gelden.
