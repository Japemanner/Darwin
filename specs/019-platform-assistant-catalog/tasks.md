# Tasks: Platformbeheer van assistentcatalogus, organisatieschakelaars en n8n-koppelingen

**Input**: Design documents from `/specs/019-platform-assistant-catalog/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`,
`quickstart.md`

**Tests**: expliciet gevraagd in de technische route (§6). De vier genoemde E2E-scenario's en de
uitbreiding van `scripts/rls-verify.mjs` zijn verplicht, niet optioneel.

**Organisation**: taken gegroepeerd per user story; alle stories zijn P1. De migratie, de
Edge Function en de client zijn gedeelde fundamenten en staan in fase 2.

> **Toepassen en deployen zijn geblokkeerd** tot u in de chat bevestigt. Taken hieronder
> beschrijven het schrijven van code; `apply_migration` en `deploy_edge_function` volgen pas na
> expliciete bevestiging (quickstart §1 en §3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: kan parallel (ander bestand, geen onderlinge afhankelijkheid)
- **[Story]**: US1 … US7
- Paden zijn relatief vanaf de repository-root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: vastleggen van de laatste invoer en de gedeelde bouwstenen

- [ ] T001 **(blokkerend)** Vul `<PLATFORM_ADMIN_EMAIL>` in `supabase/migrations/021_platform_admin_catalog.sql` en voer de pre-checks uit quickstart §0 uit (profiel bestaat, `role = 'admin'` in eigen organisatie, elke organisatie heeft een admin)
- [x] T002 [P] Voeg `E2E_PLATFORM_ADMIN_EMAIL`, `E2E_PLATFORM_ADMIN_PASSWORD` en `E2E_TEST_ORG_NAME` zonder echte waarden toe aan `.env.example`
- [x] T003 [P] Voeg `catalog_id: string` toe aan `ai_assistants` Row/Insert/Update in `src/types/database.types.ts`
- [x] T004 [P] Maak `src/components/ui/switch.tsx`: native `<button role="switch">` met `aria-checked`, verplichte `aria-label`/`aria-labelledby`, zichtbare focusring, `disabled`-staat; Enter en Spatie werken via de native button

**Checkpoint**: T001 is de enige inhoudelijke blokkade; T002–T004 kunnen direct.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: database, Edge Function, client en autorisatie waar elke user story op steunt

**⚠️ CRITICAL**: geen user story kan zonder deze fase.

- [x] T005 Maak `supabase/migrations/021_platform_admin_catalog.sql` volgens `data-model.md` §2–§5: `platform_admins`, `is_platform_admin()`, `assistant_catalog`, `platform_webhook_config` (elk met RLS aan, geen policies, `REVOKE ALL` van `anon`/`authenticated`), `ai_assistants.catalog_id` + `UNIQUE (organization_id, catalog_id)`, de zes policy-drops, `platform_save_catalog_assistant` en `platform_seed_org_assistants` (SECURITY DEFINER, `search_path = public`, `REVOKE` van `PUBLIC, anon, authenticated`, `GRANT` aan `service_role`), de volledige datavulling en `catalog_id SET NOT NULL`
- [x] T006 Maak `supabase/functions/platform-admin/index.ts`: fail-closed CORS via `ALLOWED_ORIGINS`, `OPTIONS`/`POST`-afhandeling, JWT-validatie, autorisatie via `rpc('is_platform_admin')` met een user-context client, foutcodes `UNAUTHORIZED`/`FORBIDDEN`/`VALIDATION`/`INTERNAL_ERROR` met Nederlandse meldingen, `logCode` zonder URL's/tokens; implementeer `list_organizations`
- [x] T007 [US1] Voeg in `supabase/functions/platform-admin/index.ts` de acties `list_org_assistants` en `set_assistant_active` toe (join met `assistant_catalog`, sortering op naam, `VALIDATION` bij onbekende combinatie)
- [x] T008 [US2] Voeg in `supabase/functions/platform-admin/index.ts` `get_connections` en `save_connections` toe, inclusief `isAllowedWebhookUrl`, de `/webhook-test/`-regel voor productie-URL's, leeg token = behouden, en `has_token` in het antwoord (token nooit terug)
- [x] T009 [US2] Voeg in `supabase/functions/platform-admin/index.ts` `test_connection` toe: testpayload, 10 s time-out en statusmeldingen van `flow-config`, met de opgeslagen headernaam en het opgeslagen token; wijzigt niets
- [x] T010 [US3] Voeg in `supabase/functions/platform-admin/index.ts` `save_catalog_assistant` toe via `rpc('platform_save_catalog_assistant')` met `p_actor = auth.uid()`, inclusief de validatie van naam, type en maximaal 4 voorbeeldvragen
- [x] T011 Maak `src/lib/platform-admin-client.ts`: getypeerde client voor alle acties uit `contracts/platform-admin.md`, met `PlatformAdminClientError` en dezelfde foutafhandeling als `flow-config-client.ts`
- [x] T012 Voeg `useIsPlatformAdmin()` toe aan `src/hooks/useAuth.ts` via `supabase.rpc('is_platform_admin')`, gecachet met react-query (`queryKey: ['is-platform-admin', userId]`, alleen actief bij een sessie)
- [x] T013 Pas `src/components/layout/AppShell.tsx` aan: `/settings` alleen tonen als `useIsPlatformAdmin()` waar is, in zowel de mobiele als de desktopnavigatie; `/team` blijft gegate op `profile.role === 'admin'`

**Checkpoint**: migratie geschreven (nog niet toegepast), functie geïmplementeerd (nog niet gedeployed), client en autorisatie klaar.

---

## Phase 3: User Story 1 - Assistent per organisatie aan- en uitzetten (P1) 🎯 MVP

**Goal**: platformbeheerder kiest een organisatie en zet assistenten aan/uit met een toegankelijke
schakelaar.

**Independent Test**: met een platformbeheerdersaccount een organisatie kiezen, een assistent
uit- en aanzetten, herladen, en de rij volledig met het toetsenbord bedienen.

- [x] T014 [US1] Herschrijf `src/pages/SettingsPage.tsx`: toegangscontrole met `useIsPlatformAdmin` (geen platformbeheerder → kaart "Geen toegang"), tabbladen "Assistenten" en "Nieuwe organisatie" (`CreateTenantCard` ongewijzigd), `FlowConfigCard` en de n8n-handleidingkaart verwijderen, tandwielknop met `aria-label="Koppelingen"` en de organisatielijst die naar het subscherm navigeert
- [x] T015 [US1] Maak `src/pages/SettingsOrganizationPage.tsx`: dezelfde toegangscontrole, organisatienaam, "Terug naar organisaties", één horizontale rij tegels (`flex overflow-x-auto`, vaste breedte) met icoon, naam, typelabel uit `ASSISTANT_TYPE_LABELS` en de schakelaar; optimistische update, schakelaar uitgeschakeld tijdens opslaan, bij fout terugzetten + Nederlandse toast
- [x] T016 [US1] Voeg de route `/settings/organizations/:organizationId` toe in `src/App.tsx`
- [x] T017 [P] [US1] Breid `tests/e2e/fixtures.ts` uit met `platformAdminPage` (op `E2E_PLATFORM_ADMIN_EMAIL`/`E2E_PLATFORM_ADMIN_PASSWORD`, duidelijke skip-reden) en exporteer `E2E_TEST_ORG_NAME`
- [x] T018 [P] [US1] Schrijf `tests/e2e/platform-admin.spec.ts` scenario "schakelaar met Tab en Spatie": Tab naar de schakelaar, Spatie, `aria-checked` wisselt, daarna de oorspronkelijke stand terugzetten; skip zonder `E2E_TEST_ORG_NAME`

**Checkpoint**: US1 werkt zelfstandig; dit is de MVP.

---

## Phase 4: User Story 2 - Koppelingen centraal instellen (P1)

**Goal**: één tandwiel opent het venster Koppelingen met headernaam, write-only secret,
document-URL en per assistent test-/productie-URL's met testknop.

**Independent Test**: Koppelingen openen, opslaan, heropenen (secret niet leesbaar), leeg
opslaan (secret behouden), geldige en ongeldige URL's testen.

- [x] T019 [US2] Maak `src/components/settings/ConnectionsDialog.tsx` op de bestaande dialog-component: bovenaan "Deze instellingen gelden voor alle organisaties.", headernaam, secret (`type="password"`, placeholder "Secret is ingesteld; laat leeg om te behouden" bij `has_token`), documentverwerking productie-URL, per assistent een test-URL en productie-URL met "Verbinding testen" naast de productie-URL, één knop Opslaan; resultaten en fouten als Nederlandse toast/inline melding
- [x] T020 [US2] Koppel de tandwielknop uit `src/pages/SettingsPage.tsx` aan `ConnectionsDialog` (open/sluiten, data laden bij openen, lijst verversen na opslaan)
- [x] T021 [P] [US2] Voeg in `tests/e2e/platform-admin.spec.ts` scenario "Koppelingen toont het secret nooit" toe: dialoog openen als platformbeheerder, het secretveld is leeg en toont alleen de ingesteld-placeholder; niets opslaan

**Checkpoint**: US2 werkt zelfstandig naast US1.

---

## Phase 5: User Story 3 - Assistentencatalogus beheren (P1)

**Goal**: platformbeheerder maakt en bewerkt catalogusassistenten; wijzigingen gelden voor alle
organisaties.

**Independent Test**: assistent aanmaken (bij alle organisaties aan), naam wijzigen (overal
zichtbaar), geen verwijderknop en geen systeeminstructieveld.

- [x] T022 [US3] Pas `src/pages/AssistantsPage.tsx` aan: inactieve assistenten alleen tonen aan de platformbeheerder (met label "Inactief"), "Nieuwe assistent" alleen voor de platformbeheerder, `useAssistants` ongewijzigd
- [x] T023 [US3] Pas `AssistantModal` in `src/pages/AssistantsPage.tsx` aan: veld N8N Webhook URL, de schakelaar Actief en de verwijderknop met bevestiging verwijderen; voor de platformbeheerder de definitievelden (icoon, naam, type, beschrijving, voorbeeldvragen) met de tekst "Wijzigingen gelden voor alle organisaties"
- [x] T024 [US3] Implementeer de opslagflow in `src/pages/AssistantsPage.tsx`: `save_catalog_assistant` met `catalog_id` bij bewerken en `null` bij aanmaken; na aanmaken de eigen rij ophalen via `catalog_id` en daarna de kennisbronnen koppelen
- [x] T025 [P] [US3] Werk `tests/e2e/admin-only-management.spec.ts` US3 bij: inactieve assistent niet meer zichtbaar voor de kantoorbeheerder, en de test "keeps the webhook URL field in the assistant edit modal" vervangen door een assertie dat het veld afwezig is

**Checkpoint**: US3 werkt zelfstandig; US1/US2 blijven werken.

---

## Phase 6: User Story 4 - Uitgezette assistent is nergens zichtbaar of bruikbaar (P1)

**Goal**: een uitgezette assistent verdwijnt uit overzicht, startscherm en directe link; bestaande
gesprekken blijven leesbaar, nieuwe berichten worden geweigerd.

**Independent Test**: assistent uitzetten en als lid controleren dat hij nergens meer verschijnt,
dat een oud gesprek leesbaar blijft en dat een nieuw bericht de bestaande foutmelding geeft.

- [x] T026 [US4] Pas `supabase/functions/rag-chat/index.ts` aan volgens `contracts/rag-chat.md`: `catalog_id` ophalen, `assistant_catalog.prod_webhook_url` en `platform_webhook_config` met de service role lezen, `flow_configs` en de `n8n_webhook_url`-fallback verwijderen; `is_active`- en organisatiecontrole ongewijzigd
- [x] T027 [US4] Controleer `src/pages/ChatPage.tsx` en `src/pages/HistoryPage.tsx` op het bestaande gedrag voor een uitgezette assistent (geen nieuwe code verwacht); leg de uitkomst vast in `quickstart.md` §9 als er niets wijzigt
- [x] T028 [P] [US4] Voeg in `tests/e2e/platform-admin.spec.ts` scenario "uitzetten verbergt de assistent voor een lid" toe: platformbeheerder zet een assistent uit voor `E2E_TEST_ORG_NAME`, een lid van die organisatie ziet hem niet meer op `/assistants`; oorspronkelijke stand in `finally` terugzetten; skip zonder `E2E_TEST_ORG_NAME` of zonder lid-account in die organisatie

**Checkpoint**: US4 werkt zelfstandig; server en UI zijn consistent.

---

## Phase 7: User Story 5 - Kantoorbeheerder beheert alleen kenniskoppelingen (P1)

**Goal**: kantoorbeheerder kan kennisbronnen koppelen aan aangezette assistenten, maar ziet geen
assistentbeheer en geen Instellingen.

**Independent Test**: als kantoorbeheerder een kennisbron koppelen en ontkoppelen; geen
aanmaak-/bewerk-/verwijder-/schakelbesturing; `/settings` toont "Geen toegang".

- [x] T029 [US5] Voeg `useUpdateAssistantKnowledgeBases(orgId)` toe aan `src/hooks/queries.ts` (alleen de `assistant_knowledge_bases`-diff) en verwijder `useCreateAssistant`, `useDeleteAssistant` en `useUpdateAssistant` zodra ze nergens meer gebruikt worden
- [x] T030 [US5] Pas `AssistantModal` in `src/pages/AssistantsPage.tsx` aan voor de kantoorbeheerder: alleen het blok Kennisbronnen met de titel "Kennisbronnen voor <naam>", geen definitievelden; gebruikt `useUpdateAssistantKnowledgeBases` uit T029
- [x] T031 [P] [US5] Voeg in `tests/e2e/platform-admin.spec.ts` scenario "kantoorbeheerder ziet Instellingen niet" toe: geen menu-item, `/settings` toont "Geen toegang"; skip als `E2E_EMAIL` gelijk is aan `E2E_PLATFORM_ADMIN_EMAIL`
- [x] T032 [P] [US5] Voeg een E2E-assertie toe dat de kantoorbeheerder in de assistentmodal alleen het kennisbronblok ziet (gemockte `platform-admin`- en `ai_assistants`-responses), zonder webhook-, Actief- of verwijderbesturing

**Checkpoint**: US5 werkt zelfstandig; kennisbeheer blijft intact.

---

## Phase 8: User Story 6 - Alleen de platformbeheerder maakt organisaties aan (P1)

**Goal**: `create-tenant` weigert niet-platformbeheerders en zaait alle catalogusassistenten
direct aan voor een nieuwe organisatie.

**Independent Test**: als kantoorbeheerder 403; als platformbeheerder een organisatie aanmaken en
controleren dat alle assistenten aan staan en de organisatie in de keuzelijst verschijnt.

- [x] T033 [US6] Pas `supabase/functions/create-tenant/index.ts` aan volgens `contracts/create-tenant.md`: autorisatie via `rpc('is_platform_admin')` met een user-context client, `profiles`-rolcheck verwijderen, na het profiel `rpc('platform_seed_org_assistants', { p_org, p_actor })` aanroepen en bij een seed-fout best-effort opruimen met `500`
- [ ] T034 [US6] Voer de rooktest uit quickstart §3 uit voor `create-tenant` (kantoorbeheerder → 403; platformbeheerder → nieuwe organisatie met alle assistenten aan) en leg de uitkomst vast

**Checkpoint**: US6 werkt zelfstandig.

---

## Phase 9: User Story 7 - De server dwingt alle rechten af (P1)

**Goal**: buiten de UI om kan geen enkele clientrol assistenten wijzigen of platformtabellen lezen,
terwijl kenniskoppelingen binnen de eigen organisatie blijven werken.

**Independent Test**: `scripts/rls-verify.mjs` met een member- én een kantoorbeheerdersaccount.

- [x] T035 [US7] Pas `supabase/functions/document-webhook/index.ts` aan volgens `contracts/document-webhook.md`: `platform_webhook_config` lezen met de service role, `flow_configs` verwijderen, overige logica ongewijzigd
- [x] T036 [US7] Breid `scripts/rls-verify.mjs` uit: voor een member én een kantoorbeheerder INSERT/UPDATE/DELETE op `ai_assistants` geweigerd, en `platform_admins`, `assistant_catalog` en `platform_webhook_config` niet leesbaar; bestaande positieve controles behouden
- [x] T037 [US7] Verwijder `supabase/functions/flow-config/index.ts`, `src/lib/flow-config-client.ts` en `tests/e2e/flow-config.spec.ts`; verwijder de resterende imports in `src/pages/SettingsPage.tsx`
- [ ] T038 [US7] Draai `node scripts/rls-verify.mjs` en leg de uitkomsten vast (verwacht: alle schrijf- en leesweigeringen PASS, positieve controles PASS)

**Checkpoint**: alle zeven user stories zijn functioneel en server-side afgedwongen.

---

## Phase 10: Polish & Cross-Cutting Concerns

- [x] T039 [P] Werk `FEATURES.md` bij via `@feature-tracker` (catalogus, schakelaar, koppelingen, platformbeheerder)
- [ ] T040 [P] Voer de verificatiequeries uit quickstart §2 uit en noteer de uitkomsten (10 rijen, 0 zonder catalogus, Darwin 3 actief, Gerard_Tekelenburg 2 actief, 0 schrijfpolicies, `has_token = true`, 1 platformbeheerder)
- [x] T041 Draai `npx tsc --noEmit`
- [ ] T042 Draai `npx eslint src/ --max-warnings 0`
- [x] T043 Draai `npm run build`
- [ ] T044 Draai `npx playwright test tests/e2e/platform-admin.spec.ts`
- [x] T045 Draai de volledige Playwright-regressie
- [ ] T046 Commit in conventionele stappen (migratie, functies, frontend, tests) met Engelse commit messages
- [ ] T047 **(handmatig, na de frontend-release)** Verwijder de gedeployde `flow-config`-functie in het Supabase-dashboard volgens quickstart §5

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (1)**: T001 blokkeert de migratie; T002–T004 kunnen direct
- **Foundational (2)**: T005–T010 vereisen T001; T011–T013 vereisen T006 (contract)
- **US1 (3)**: vereist T005, T007, T011, T012, T013
- **US2 (4)**: vereist T005, T008, T009, T011
- **US3 (5)**: vereist T005, T010, T011, T012
- **US4 (6)**: vereist T005 en T026; de UI-zichtbaarheid komt uit T022 (US3)
- **US5 (7)**: vereist T012, T013, T022, T023, T029 (hook) vóór T030 (modal)
- **US6 (8)**: vereist T005 (seedfunctie) en T006 (patroon)
- **US7 (9)**: vereist T005 (policy-drops) en T035; T037 vereist T014 (oude UI weg)
- **Polish (10)**: vereist alle stories

### Within Each User Story

- Eerst de implementatie, dan de bijbehorende E2E-test; de test moet aantoonbaar falen op de
  oude code voordat hij groen wordt
- `platform-admin/index.ts` (T006–T010) is één bestand: strikt sequentieel
- `src/pages/AssistantsPage.tsx` (T022–T024, T029) is één bestand: sequentieel
- `tests/e2e/platform-admin.spec.ts` (T018, T021, T028, T031) is één bestand: sequentieel

### Parallel Opportunities

- T002, T003, T004
- T011 en T012 (verschillende bestanden)
- T014 en T019 (SettingsPage vs. ConnectionsDialog) na T011
- T026 en T029 (rag-chat vs. AssistantModal)
- T033 en T035 (twee losse Edge Functions)
- T039 en T040 (documentatie vs. verificatie)

---

## Parallel Example: na de fundamenten

```text
# Ontwikkelaar A (US1/US2, settings)
T014 SettingsPage  →  T019 ConnectionsDialog  →  T020 koppelen

# Ontwikkelaar B (US3/US5, assistenten)
T022 zichtbaarheid  →  T023 modal  →  T024 opslag  →  T030 kennisblok

# Ontwikkelaar C (US4/US6/US7, server)
T026 rag-chat  →  T033 create-tenant  →  T035 document-webhook  →  T036 rls-verify
```

---

## Implementation Strategy

### MVP First (US1)

1. T001–T004 (setup)
2. T005–T013 (fundamenten)
3. T014–T018 (schakelaar)
4. **STOP en valideer**: migratie toepassen en `platform-admin` deployen pas na bevestiging;
   daarna US1 met het toetsenbord en via herladen testen

### Incremental Delivery

1. Fundamenten + US1 → valideer → demo
2. US2 (koppelingen) → valideer
3. US3 + US5 (catalogus en kenniskoppelingen) → valideer
4. US4 (zichtbaarheid en server) → valideer
5. US6 + US7 (organisaties en afdwinging) → valideer
6. Polish, regressie, release, daarna `flow-config` verwijderen

### Release Gates

| Gate | Wanneer | Voorwaarde |
|---|---|---|
| Migratie toepassen | na T005 en T001 | uw expliciete bevestiging + pre-checks groen |
| Edge Functions deployen | na T026, T033, T035 | bevestiging per functie, in de volgorde van quickstart §3 |
| Frontend releasen | na T041–T044 | tsc/eslint/build/feature-tests groen |
| `flow-config` verwijderen | na de frontend-release | T047, handmatig |

---

## Notes

- [P] = ander bestand, geen onderlinge afhankelijkheid
- De migratie is de enige wijziging die bestaande data raakt; zonder bevestiging wordt hij niet
  toegepast
- Geen nieuwe npm-dependencies; de schakelaar is een native button
- UI-teksten Nederlands in u-vorm, code en commits Engels
- Geen tokens, URL's of klantinhoud in logs, PostHog of browseropslag
- Commit na elke logische groep (migratie, functies, frontend, tests)

---

## Implementation Status (2026-10-31)

**Gereed (code geschreven, niet toegepast/gedeployed):** T002–T033 en T035–T037, T039.

**Verificatie:**

| Check | Uitkomst |
|---|---|
| `npx tsc --noEmit` | groen |
| `npm run build` | groen (bestaande chunk-size-waarschuwing) |
| volledige Playwright-suite | 18 passed, 65 skipped, 0 failed |
| `tests/e2e/platform-admin.spec.ts` | 5 tests, allemaal geskipt (E2E-platform-/lidaccount ontbreekt) |
| `eslint src/ --max-warnings 0` | **niet groen**: 6 bestaande waarschuwingen in `src/App.tsx`, `src/components/ui/toast.tsx`, `src/lib/posthog.tsx` (zelfde als bij feature 018, niet door deze feature veroorzaakt) |

**Geblokkeerd:**

- **T001** — e-mailadres platformbeheerder ontbreekt; migratie 021 bevat nog `<PLATFORM_ADMIN_EMAIL>`.
- **T034, T038, T040** — vereisen een toegepaste migratie en gedeployde functies.
- **T044** — vereist `E2E_PLATFORM_ADMIN_EMAIL/PASSWORD`, `E2E_EMAIL/PASSWORD` en `E2E_TEST_ORG_NAME`.
- **T042** — zie de eslint-uitkomst hierboven; de gate faalt op bestaande waarschuwingen.
- **T046** — nog geen commits gemaakt.
- **T047** — handmatig, na de frontend-release.

**Niet gedaan, conform de route:** geen `apply_migration`, geen `deploy_edge_function`, geen
frontend-release.

