# Implementation Plan: Beheerfuncties alleen voor beheerders

**Branch**: `010-admin-only-management` | **Date**: 2026-10-15 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/010-admin-only-management/spec.md`

## Summary

Beheerfuncties (aanmaken, bewerken, verwijderen van assistenten, kennisbronnen,
documenten, kennisitems en koppelingen, plus document-upload) worden beheerder-only.
Adviseurs (rol member) krijgen een alleen-lezen weergave: alleen actieve assistenten
met leesbare typelabels ("Chat", "Risico-analyse") en omschrijving, kennisbronnen
alleen-lezen inclusief documentstatus; eigen gesprekken, berichten en feedback
blijven volledig werken. De afdwinging is tweelaags: conditioneel renderen in de UI
(besturing verdwijnt uit de DOM, dus ook onbereikbaar via toetsenbord) én RLS op
databaseniveau (migratie 015 vervangt de permissive schrijf-policies door
admin-only-policies, inclusief storage-policies voor bucket `knowledge-documents`),
zodat omzeiling van de UI wordt geweigerd.

## Technical Context

**Language/Version**: TypeScript 5, React 18, Vite, PostgreSQL 15 (Supabase)

**Primary Dependencies**: `@supabase/supabase-js` v2, TanStack Query (`src/hooks/queries.ts`), Zustand (`src/store/authStore.ts`), Tailwind CSS + shadcn/ui, lucide-react, Playwright (e2e)

**Storage**: Supabase PostgreSQL met RLS op alle tabellen; Supabase Storage bucket `knowledge-documents` (private, org-pad-gebaseerde policies)

**Testing**: Playwright (tests/e2e, REST gemocked via `page.route`) + nieuw Node-script `scripts/rls-verify.mjs` (directe supabase-js aanroepen tegen de live database voor de 15 schrijfcombinaties en storage — SC-001/SC-002)

**Target Platform**: Web (Netlify) + Supabase platform (Auth, Database, Storage)

**Project Type**: web-app

**Performance Goals**: geen nieuwe prestatie-eisen; de RLS-helper (`is_org_admin()`, STABLE) wordt per statement gecached — geen meetbare invloed op querytijd verwacht

**Constraints**: RLS op elke tabel (constitution/AGENTS.md), PKCE-auth, geen secrets in client code, NL-zakelijke UI-teksten (constitution I), WCAG 2.1 AA (constitution IV), geen stille fouten (constitution V)

**Scale/Scope**: 2 rollen, 5 tabellen, 1 storage-bucket, 2 pagina's (AssistantsPage, KnowledgePage) + KBSlideOver, 1 SQL-migratie, 1 nieuw e2e-spec, 1 nieuw verificatiescript

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Status | Toelichting |
|---|------|--------|-------------|
| 1 | Dutch UI copy (Principle I) | PASS | Nieuwe/behouden labels zijn Nederlands zakelijk: "Chat", "Risico-analyse", "Inactief". Members krijgen een aangepaste pagina-ondertitel zonder beheer-taal ("Beheer je AI assistenten…"). |
| 2 | Concept, never advice (Principle II) | PASS | Geen gegenereerde outputs in deze feature; advies-taal wordt niet geïntroduceerd. |
| 3 | Client data sensitivity (Principle III) | PASS | Geen nieuwe gegevensstromen; de feature verkleint juist het schrijbereik van members. Systeeminstructies en webhook-URL's worden aan members niet meer getoond (vermindering van blootstelling). |
| 4 | Accessibility WCAG 2.1 AA (Principle IV) | PASS | FR-004/SC-003: beheerbesturing wordt conditioneel gerenderd (niet in de DOM = niet in tab-volgorde), in plaats van visueel verbergen. Focus-states en semantische markup blijven ongewijzigd. |
| 5 | Typed external clients, no silent failures (Principle V) | PASS | Geen nieuwe externe aanroepen. RLS-weigeringen die een member onverhoopt toch tegenkomt (bijv. oude bundel na deploy) vallen terug op de bestaande error-afhandeling van de mutatiehooks (getoonde foutmelding, geen stille fout). |
| 6 | Minimal scope (Principle VI) | PASS | Geen nieuwe rollen, geen AdminRoute-wrapper (binnen-pagina gating volstaat — leesweergave blijft voor members zichtbaar), geen i18n-systeem, geen nieuwe tabelkolommen. Bestaand inline rolpatroon (`profile?.role === 'admin'`, zie `AppShell.tsx:35`, `SettingsPage.tsx:385`) wordt gevolgd. |

**Re-check na Phase 1 (design): PASS** — het ontwerp voegt één herbruikbare SQL-helper toe (`is_org_admin()`) in plaats van 15+ inline EXISTS-subqueries; dit is consistent met het bestaande `get_user_org_id()`-patroon en vermindert duplicatie (geen scope-creep).

## Project Structure

### Documentation (this feature)

```text
specs/010-admin-only-management/
├── plan.md                       # Dit bestand
├── research.md                   # Phase 0: onderzoeksbeslissingen
├── data-model.md                 # Phase 1: entiteiten + RLS-policy-matrix voor/na
├── quickstart.md                 # Phase 1: rolloutvolgorde en verificatie
├── contracts/
│   └── permissions-matrix.md     # Phase 1: autorisatiecontract (DB + storage + UI)
├── checklists/
│   └── requirements.md           # Spec-quality-checklist (afgevinkt)
└── tasks.md                      # /speckit.tasks (nog niet aangemaakt)
```

### Source Code (repository root)

```text
supabase/
├── migrations/
│   └── 015_admin_only_writes.sql    # NIEUW: RLS-hardening (helper + 14 policies + 3 storage-policies)
└── functions/                        # Ongewijzigd (edge functions draaien met service role, omzeilen RLS)

src/
├── pages/
│   ├── AssistantsPage.tsx            # Rol-gating, typelabels, fallback-fix, is_active-filter (members)
│   └── KnowledgePage.tsx             # Rol-gating (aanmaak/bewerk/upload/delete/item-formulier), isAdmin-prop naar KBSlideOver
├── hooks/
│   └── queries.ts                    # Ongewijzigd (mutatiehooks blijven bestaan; alleen admin-UI gebruikt ze)
├── lib/
│   └── storage.ts                    # Ongewijzigd (afdwinging ligt in RLS; aanroepers zijn admin-only UI)
└── store/
    └── authStore.ts                  # Ongewijzigd (profiel + rol al aanwezig)

tests/
├── e2e/
│   ├── fixtures.ts                   # Member-login-fixture (E2E_MEMBER_EMAIL/PASSWORD)
│   ├── admin-only-management.spec.ts # NIEUW: UI-gating (member read-only, admin volledig)
│   └── document-webhook.spec.ts      # Bestaande mocks hergebruiken voor member-read-only asserts

scripts/
└── rls-verify.mjs                    # NIEUW: directe data-laag tests (15 combinaties + storage)
```

**Structure Decision**: Bestaande structuur volgen — alles zit al in de twee pagina's (er bestaat geen aparte AssistentCard/KBCard-component, zie research). Conditioneel renderen gebeurt inline in de bestaande componenten met het bestaande `profile?.role === 'admin'`-patroon; een nieuwe `isAdmin`-helper of AdminRoute-wrapper wordt niet geïntroduceerd (constitution VI: geen abstracties voor beperkt hergebruik; leesweergave moet voor members zichtbaar blijven dus route-guarding is onwenselijk).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

Geen violations — alle gates PASS. Geen verantwoording nodig.