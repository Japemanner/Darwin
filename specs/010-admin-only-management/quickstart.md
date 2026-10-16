# Quickstart & Rollout: 010-admin-only-management

**Date**: 2026-10-15 | **Feature**: [spec.md](spec.md)

Handmatige stappen voor Jaap. Dit Supabase-project is **productie**; de
volgorde hieronder is verplicht.

## 1. Voorbereiding (vóór de release)

- Zorg voor een **member-testaccount** in een (test-)organisatie: een gebruiker
  met `profiles.role = 'member'`. Zet de credentials in `.env.local` als
  `E2E_MEMBER_EMAIL` en `E2E_MEMBER_PASSWORD` (en later in de Netlify/CI
  environment voor de regressiesuite; de e2e-tests skippen met duidelijke reden
  als ze ontbreken).
- Optioneel: markeer één assistent als `is_active = false` om het
  "Inactief"-label (admin-zicht) en het verbergen voor members te kunnen
  controleren.

## 2. Lokale ontwikkeling en geautomatiseerde checks

```bash
npx tsc --noEmit
npx eslint src/ --max-warnings 0
npm run build
bash scripts/fitness-check.sh
npx playwright test                                # e2e met page.route-mocks
node scripts/rls-verify.mjs                        # live-DB: 15 combinaties + storage (SC-001/002)
```

`scripts/rls-verify.mjs` heeft nodig: `VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`, `E2E_MEMBER_EMAIL`, `E2E_MEMBER_PASSWORD` uit
`.env.local` en draait tegen de Supabase-instantie die de app gebruikt
(lokaal dev tegen de project-URL; vóór migratie 015 faalt dit script — dat is
het bewijs dat het goed test). Verwacht na migratie: alle schrijfchecks FAIL
voor member (geweigerd), alle lees- en gesprekschecks PASS.

## 3. Releasevolgorde (verplicht)

| Stap | Actie | Waarom |
|------|-------|--------|
| 1 | Feature-PR naar `develop`; Netlify preview testen (admin + member login) | Ontwikkelingspatroon AGENTS.md: develop → main |
| 2 | Merge naar `main` → productie-frontend deploy | Members verliezen de beheerbesturing in de UI (FR-001/003/004/005/006, story 1-2) |
| 3 | Pas migratie `015_admin_only_writes.sql` toe via de **Supabase MCP** (AGENTS.md: alle schema-wijzigingen via MCP) | Sluit de database-afdwinging (story 4, FR-007/008) |
| 4 | Draai `node scripts/rls-verify.mjs` tegen productie (met productie-URL + member-account) | SC-001/SC-002: 15 weigeringen + storage-weigeringen bewezen |
| 5 | Supabase MCP-verificatie: RLS enabled op alle tabellen (F-01) en bucket-policies expliciet (F-10); schrijf resultaat in FITNESS.md via `@fitness-checker` | Constitution: RLS/bucket-verificatie na elke feature |
| 6 | Handmatige productie-check (5 min): member-login → assistentenlijst toont alleen actieve met "Chat"/"Risico-analyse" en zonder bewerkknop; kennisbronnen read-only; admin-login → alles ongewijzigd incl. "Inactief"-label | Eindcontrole van de acceptatiecriteria |

**Venster tussen stap 2 en 3**: de UI is al admin-only, de database nog niet.
In dit korte venster kan iemand met een oude bundel of directe REST-toegang nog
schrijven. Dit venster is bewust klein gehouden (migratie direct na de
frontend-deploy in dezelfde werksessie). Omgekeerd is de migratie vóór de
frontend-deploy onwenselijker: dan zien members de oude knoppen nog wél en
krijgen ze op elke klik een RLS-fout — lelijke beleving voor alle adviseurs.

**Cutover-gedrag**: er is géén data-wipe en géén configuratie-stap. Admins
merken niets; members verliezen alleen besturing. Bestaande gesprekken,
berichten en feedback blijven onaangetast (FR-010).

## 4. Verificatie met SQL (na stap 3)

```sql
-- Policies per tabel tonen de admin-only-varianten:
SELECT tablename, policyname, cmd FROM pg_policies
WHERE schemaname = 'public' AND tablename IN (
  'ai_assistants','knowledge_bases','knowledge_base_documents',
  'knowledge_items','assistant_knowledge_bases')
ORDER BY tablename, cmd;
-- Verwacht: SELECT-policies ongewijzigd; INSERT/UPDATE/DELETE-policies heten "Admins can …"
-- en bevatten is_org_admin()

-- Helper bestaat:
SELECT proname FROM pg_proc WHERE proname = 'is_org_admin';

-- Storage-policies (F-10):
SELECT policyname, cmd FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND qual LIKE '%knowledge-documents%';
-- Verwacht: read = org-pad (ongewijzigd), INSERT/UPDATE/DELETE = org-pad + admin
```

## 5. Rollback (bij nood)

Migratie 015 is volledig omkeerbaar: de oude policy-definities staan in
`001_initial_schema.sql:218-245`, `002_rag_assistant_management.sql:101-116`,
`007_multitenancy_hardening.sql:83-186` en `:217-227`. Een rollback-script
dropt de admin-only-policies en herstelt de oude org-only-definities
(gegevens zijn niet gewijzigd, alleen policies). De UI-wijzigingen zijn via
deploy-rollback (`main` revert) terug te draaien.