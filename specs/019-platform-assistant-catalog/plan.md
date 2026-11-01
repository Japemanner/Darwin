# Implementation Plan: Platformbeheer van assistentcatalogus, organisatieschakelaars en n8n-koppelingen

**Branch**: `019-platform-assistant-catalog` | **Date**: 2026-10-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/019-platform-assistant-catalog/spec.md` and the
confirmed technical route (inventory, migration, Edge Function, frontend, tests).

## Summary

Assistenten worden een platformbrede catalogus (`assistant_catalog`) met per organisatie een
`ai_assistants`-rij die aan een catalogusitem hangt. De bestaande rij blijft het knooppunt voor
gesprekken en kennisbronkoppelingen, dus er hoeft geen enkele foreign key te worden verlegd.
De schakelaar per organisatie is `ai_assistants.is_active`. Eén platformbeheerder
(`platform_admins` + `is_platform_admin()`) beheert catalogus, schakelaars en koppelingen via
een nieuwe Edge Function `platform-admin`; `rag-chat`, `document-webhook` en `create-tenant`
lezen de centrale koppeling (`platform_webhook_config`) met de service role. De token is
write-only en verlaat de server nooit. `flow-config` en de bijbehorende client verdwijnen.

## Technical Context

**Language/Version**: TypeScript 5.x (Vite/React 18), Deno (Supabase Edge Functions), SQL
(PostgreSQL 15 via Supabase)

**Primary Dependencies**: `@supabase/supabase-js` v2, `@tanstack/react-query`, `react-router-dom`,
Tailwind CSS v3, `lucide-react`, Playwright (`@playwright/test`). Geen nieuwe dependencies.

**Storage**: Supabase PostgreSQL met RLS op elke tabel; Storage blijft ongewijzigd.

**Testing**: Playwright E2E (`tests/e2e/`), `scripts/rls-verify.mjs`, `tsc --noEmit`,
`eslint src/ --max-warnings 0`, `npm run build`.

**Target Platform**: Netlify SPA (browser) + Supabase (Postgres, Auth, Edge Functions).

**Project Type**: Web application (single Vite frontend + Supabase Edge Functions).

**Performance Goals**: schakelaar opslaan voelt direct (optimistische UI, server-roundtrip
< 2 s bij normale netwerklatentie); Koppelingen-dialoog laadt één cataloguslijst; geen
wijziging in chat-latency (één extra service-role read per bericht).

**Constraints**: token nooit in client, logs, URL's of browseropslag; geen nieuwe npm-dependency;
Nederlandse UI in u-vorm, Engelse code/identifiers/commits; alleen bestanden die deze spec nodig
heeft; migratie en deploys pas na expliciete bevestiging.

**Scale/Scope**: nu 2 organisaties en 5 assistentrijen; ontwerp schaalt naar N organisaties
(elke nieuwe organisatie krijgt één rij per catalogusitem). Ongeveer 15 bestaande bestanden
gewijzigd, 3 verwijderd (waaronder `flow-config`) en 7 nieuw (migratie, Edge Function, drie
frontendbestanden, client, E2E-spec).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Result |
|---|---|---|
| I. Dutch UI, English code | Alle nieuwe schermteksten Nederlands in u-vorm; code, identifiers, comments en commits Engels | PASS |
| II. Concept, never advice | Geen nieuwe modeloutput of adviserende formulering; alleen beheerconfiguratie | PASS |
| III. Client data sensitivity (NON-NEGOTIABLE) | Token wordt nooit naar de client gestuurd of gelogd; URL's niet in logs; geen clientinhoud in logging; geen secrets in browseropslag (alleen React-state van het wachtwoordveld) | PASS |
| IV. Accessibility WCAG 2.1 AA | `role="switch"`, `aria-checked`, toegankelijke naam met assistent + organisatie, zichtbare focusring, native button (Enter/Space), labels op alle velden, statusmeldingen via toast | PASS |
| V. Typed external clients, no silent failures | Nieuwe getypeerde `platform-admin-client` met foutcodes en Nederlandse meldingen; schakelaar springt terug met toast; opslaan/testen tonen fouten | PASS |
| VI. Minimal scope | Alleen de in de route genoemde bestanden; test-URL alleen opslaan; geen catalogusverwijdering; geen rolbeheer-UI; geen extra abstracties | PASS |

**Security constraints**: RLS aan op `platform_admins`, `assistant_catalog` en
`platform_webhook_config` (geen policies, `REVOKE ALL` van `anon`/`authenticated`); geen secrets
in de bundle; geprivilegieerde acties in Edge Functions; `flow-config` wordt na de release
verwijderd.

**Post-design re-check**: PASS. De enige afwijking van de oorspronkelijke route is het
aanvullend droppen van drie verweesde permissieve policies op `ai_assistants` (zie research
#3). Zonder die correctie faalt FR-024/SC-002; het is dus geen scope-uitbreiding maar het
sluiten van een bestaand RLS-gat dat de route veronderstelde al dicht te zijn.

## Project Structure

### Documentation (this feature)

```text
specs/019-platform-assistant-catalog/
├── plan.md                       # This file
├── spec.md                       # Feature specification
├── research.md                   # Phase 0 decisions
├── data-model.md                 # Phase 1 schema, policies, functions, data fill
├── quickstart.md                 # Phase 1 release order, env, verification
├── contracts/
│   ├── platform-admin.md         # New Edge Function contract
│   ├── rag-chat.md               # Delta: URL/auth resolution
│   ├── document-webhook.md       # Delta: central document URL
│   └── create-tenant.md          # Delta: authorization + seeding
├── checklists/requirements.md
└── tasks.md                      # /speckit.tasks (not created here)
```

### Source Code (repository root)

```text
supabase/
├── migrations/
│   └── 021_platform_admin_catalog.sql        # new
└── functions/
    ├── platform-admin/index.ts               # new
    ├── rag-chat/index.ts                     # modified (URL/auth resolution)
    ├── document-webhook/index.ts             # modified (central config)
    ├── create-tenant/index.ts                # modified (platform admin + seed)
    └── flow-config/                          # deleted after release

src/
├── App.tsx                                   # + /settings/organizations/:organizationId
├── components/
│   ├── layout/AppShell.tsx                   # Instellingen gated by platform admin
│   ├── settings/ConnectionsDialog.tsx         # new
│   └── ui/switch.tsx                         # new
├── hooks/
│   ├── useAuth.ts                            # + useIsPlatformAdmin()
│   └── queries.ts                            # + useUpdateAssistantKnowledgeBases; -3 hooks
├── lib/
│   ├── platform-admin-client.ts              # new
│   └── flow-config-client.ts                 # deleted
├── pages/
│   ├── SettingsPage.tsx                      # rewritten shell + org list
│   ├── SettingsOrganizationPage.tsx          # new
│   └── AssistantsPage.tsx                    # catalog-aware modal
└── types/database.types.ts                   # + ai_assistants.catalog_id

tests/e2e/
├── fixtures.ts                               # + platformAdminPage, E2E_TEST_ORG_NAME
├── platform-admin.spec.ts                    # new
├── admin-only-management.spec.ts             # US3 assertions updated
└── flow-config.spec.ts                       # deleted

scripts/rls-verify.mjs                        # + assistant/platform table checks
.env.example                                  # + E2E platform-admin vars
AGENTS.md                                     # plan pointer
```

**Structure Decision**: bestaande single-projectstructuur (Vite SPA in `src/`, Supabase in
`supabase/`). Geen nieuwe mappen buiten `src/components/settings/` en de bestaande
`tests/e2e/`. De nieuwe Edge Function volgt exact het patroon van `flow-config` (fail-closed
CORS, JWT-validatie, `logCode`).

## Phase 0 & 1 Outputs

- `research.md`: 12 beslissingen met rationale en alternatieven (o.a. per-organisatie
  `ai_assistants`-rijen, waarom een aparte `platform_admins`-tabel en niet een rolwaarde,
  RLS-drift, functie-grants, URL-validatie, tokenopslag).
- `data-model.md`: tabellen, kolommen, constraints, RLS-matrix, functies en de volledige
  datavulling met de bevestigde koppeltabel.
- `contracts/`: verzoek/antwoord per actie en de deltas van de drie bestaande functies.
- `quickstart.md`: releasevolgorde (migratie → functies → frontend → `flow-config` weg),
  env-variabelen, verificatiequeries en de handmatige stappen die uw bevestiging vragen.

## Implementation status (2026-11-01)

De technische route is opnieuw aangeleverd en regel voor regel vergeleken met dit plan; er zijn
geen inhoudelijke afwijkingen gevonden. Stand van zaken, geverifieerd via Supabase MCP:

- Migratie `021_platform_admin_catalog.sql` is toegepast als `platform_admin_catalog` (remote
  versie `20261031174605`). Nummer 021 in plaats van 020, omdat
  `020_profiles_update_columns.sql` dat nummer al bezette.
- `platform-admin` (v2), `rag-chat` (v10), `document-webhook` (v9) en `create-tenant` (v11) zijn
  actief. `flow-config` (v6) staat nog, zoals gepland, en wordt pas na de frontendrelease
  verwijderd (quickstart §5, T047).
- De inventarisatie en de koppeltabel uit routepunt 0 zijn bevestigd en uitgevoerd: vijf
  catalogusitems, tien `ai_assistants`-rijen, actieve set ongewijzigd (Darwin 3,
  Gerard_Tekelenburg 2).
- Het e-mailadres van de platformbeheerder is aangeleverd en in de migratie verwerkt.

Resterend: de verificatietaken die E2E-accounts vereisen (T034, T038, T044) en het handmatig
verwijderen van `flow-config` (T047). T040, T042 en T046 zijn op 2026-11-01 afgerond.

## Complexity Tracking

Geen constitution-violations. Geen extra projecten, lagen of abstracties toegevoegd.
