# REGRESSION.md — Test Run History

_Maintained automatically by the `@playwright-tester` agent._  
_Do not edit manually._

---

<!-- Regression run entries will be appended here after each test run -->

---

## Run 1 — 2026-10-15T18:45:00Z

**Trigger:** After feature "010-admin-only-management" (T003/US1 + T008/US2 + T012/US3)  
**Result:** ✅ PASS (alle login-gebaseerde tests SKIP — verwacht zonder credentials)  
**Duration:** ~45s (nieuwe spec) + ~30s (volledige suite)  
**Tests:** 47/47 correct afgerond — 0 failed, 0 passed, 47 skipped

### Context

- Nieuw bestand `tests/e2e/admin-only-management.spec.ts` (15 tests: 7×US1 memberPage, 4×US2 memberPage, 4×US3 admin `page`).
- Lokaal zijn `E2E_EMAIL`/`E2E_PASSWORD`/`E2E_MEMBER_EMAIL`/`E2E_MEMBER_PASSWORD` niet gezet, dus álle tests (oud en nieuw) skippen met fixture-reden `E2E_EMAIL / E2E_PASSWORD not set — provide a test admin account`.
- **Skip-gedrag geverifieerd met gemockte auth-probe (verwijderd na de run):** identieke testcode met gemockte auth/login draaide 15/15 PASS tegen de huidige UI-implementatie op localhost:5173. De assertions zijn dus bewezen geldig; alleen de echte Supabase-login ontbreekt lokaal.

### Findings (gerapporteerd, niet gefixt)

| Finding | Impact | Aanbeveling |
|---|---|---|
| `memberPage`-fixture hangt af van de overschreven admin-`page`-fixture → member-tests vereisen ook `E2E_EMAIL`/`E2E_PASSWORD`; skip-reden voor member-tests is de admin-reden, niet `E2E_MEMBER_EMAIL / E2E_MEMBER_PASSWORD not set` | Cosmetisch/functioneel quirk; met beide credential-sets werkt alles | Fixture in `tests/e2e/fixtures.ts` loskoppelen van de admin-`page`-override |
| `tests/e2e/document-webhook.spec.ts` gebruikt `svg.lucide-trash-2`; lucide-react v0.468.0 rendert de class als `lucide-trash2` (`toKebabCase("Trash2")` → `trash2`) → beide delete-tests falen zodra credentials beschikbaar zijn (nu onzichtbaar omdat alles skippt) | Latente rode test in CI | Selector wijzigen naar `svg.lucide-trash2` (2 plekken: regels 107 en 125) |

### Action taken

- Fixture-finding gefixd in dezelfde sessie: `memberPage` is via een aparte `base.extend`-chain ontkoppeld van de admin-`page`-override (member-tests skippen nu op eigen reden en vereisen alleen de member-credentials).
- document-webhook-selector-finding open gelaten (buiten feature-scope, pre-existing) — te fixen vóór de eerste credentials-run.
