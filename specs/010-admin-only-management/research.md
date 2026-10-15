# Research: Beheerfuncties alleen voor beheerders

**Date**: 2026-10-15 | **Feature**: [spec.md](spec.md) | **Branch**: `010-admin-only-management`

Alle NEEDS CLARIFICATION-achtige onbekenden zijn onderzocht in de codebase
(UI-verkenning + RLS-migraties 001, 002, 007, 013). Bevindingen per beslissing.

## 1. Rol-bepaling in de frontend

**Decision**: Inline check `const isAdmin = profile?.role === 'admin'` in
`AssistantsPage.tsx` en `KnowledgePage.tsx`, conform het bestaande patroon
(`src/components/layout/AppShell.tsx:35`, `src/pages/SettingsPage.tsx:385`).
Geén nieuwe helper (`useRole`-hook of `src/lib/roles.ts`).

**Rationale**: Het profiel met `role: 'admin' | 'member'` staat al in de
Zustand-store (`src/store/authStore.ts:71-75`, `:135-137`) en wordt door
`useAuth()` (`src/hooks/useAuth.ts:3-6`) ontsloten. Er zijn na deze feature
precies 2 nieuwe gebruikspunten; een helper-abstrahering voor een one-liner
voegt niets toe (constitution VI) en wijkt af van het bestaande patroon.

**Alternatives considered**:
- Centrale `isAdmin()`-helper in een nieuwe lib/hook — afgewezen: duplicatie
  is minimaal en het bestaande patroon is al inline (3 bestaande plekken).
- `AdminRoute`-wrapper rond `/assistants` en `/knowledge` — afgewezen: de
  leesweergave moet juist zichtbaar blijven voor members; route-blocking is
  ongewenst. Gating hoort binnen de pagina (patroon `SettingsPage.tsx:385`).

## 2. Waar zit de beheer-UI vandaag (blauwdruk voor de gating)

**Decision**: Alle beheerbesturing zit in precies twee pagina's; per element
wordt conditioneel gerenderd met `{isAdmin && …}` — weg uit de DOM en dus
onbereikbaar via toetsenbord (FR-004/SC-003).

**Rationale** (verificatie met file:line):

| Element | Locatie | Member-zichtbaar na feature |
|---|---|---|
| Knop "Nieuwe assistent" | `src/pages/AssistantsPage.tsx:70-72` + CTA in EmptyState `:80` | Nee (CTA-variant zonder knop) |
| Bewerkknop (Pencil) | `src/pages/AssistantsPage.tsx:113-115` | Nee |
| Verwijderen (in modal) | `src/pages/AssistantsPage.tsx:324-333` + confirm `:343-361` | Nee (modal niet te openen zonder triggerknop) |
| Webhook-URL-veld | `src/pages/AssistantsPage.tsx:290-294` (alleen in bewerk-/aanmaakmodal) | Nee (modal is admin-only via triggers) |
| KB-koppelingscheckboxen | `src/pages/AssistantsPage.tsx:295-315` (zelfde modal) | Nee |
| Typewaarde als tekst | `src/pages/AssistantsPage.tsx:94` (`{a.type}`) | Vervangen door labelmap (beslissing 3) |
| Fallback description→system_prompt | `src/pages/AssistantsPage.tsx:100` | Verwijderd: alleen `{a.description ?? ''}` |
| is_active-filter | Query `src/hooks/queries.ts:36-44` filtert niet | Page-filter voor members (beslissing 4) |
| Knop "Nieuwe kennisbron" | `src/pages/KnowledgePage.tsx:58-60` + EmptyState-CTA `:68` | Nee (CTA-variant zonder knop) |
| KB-bewerkknop | `src/pages/KnowledgePage.tsx:86-88` | Nee |
| Upload-zone | `src/pages/KnowledgePage.tsx:320-327` (in KBSlideOver) | Nee (slide-over krijgt `isAdmin`-prop) |
| Document-verwijderknop | `src/pages/KnowledgePage.tsx:355-357` | Nee |
| Kennisitem-formulier | `src/pages/KnowledgePage.tsx:367-401` | Nee |
| Kennisitem-verwijderknop | `src/pages/KnowledgePage.tsx:423-425` | Nee |
| Documentstatusbadges | `src/pages/KnowledgePage.tsx:346-354` | Ja (FR-006: leesbaar voor members) |
| Kennisitem-lijst + embeddingstatus | `src/pages/KnowledgePage.tsx:408-428` | Ja (alleen-lezen) |
| Tab "Gekoppeld" (assistenten per bron) | `src/pages/KnowledgePage.tsx:433-451` | Ja (bestaande leesweergave, mag blijven) |

**Belangrijke ontdekking**: de kennisbronkaart opent de lees-detailweergave via
kaartklik (`KnowledgePage.tsx:73`, `setSelectedKB` → KBSlideOver `:103-108`),
onafhankelijk van de bewerkknop. FR-006 blijft dus behaald: members verliezen de
bewerkknop maar behouden de documentenweergave inclusief status.

**Alternatives considered**:
- Modals defensively verbergen voor members naast de triggers — afgewezen:
  de modals zijn uitsluitend te openen via de (dan verdwenen) knoppen; state
  kan niet gezet worden zonder trigger.
- Visueel verbergen met CSS (`hidden`/`sr-only`) — afgewezen: schendt FR-004
  en WCAG 2.1 AA (constitution IV); elementen blijven dan in de tab-volgorde.

## 3. Leesbare typelabels

**Decision**: Lokale labelmap in `AssistantsPage.tsx` met de waarden
`chat → "Chat"`, `risico_analyse → "Risico-analyse"` (FR-001), gebruikt voor de
kaartbadge (`:94`). De bestaande `ASSISTANT_TYPES`-map (`:32-35`, met emoji's)
blijft ongemoeid voor het Select-veld in de admin-modal.

**Rationale**: Er is geen centraal labels/i18n-mechanisme in de codebase (alle
UI-labels hardcoded Nederlands). Een tweede lokale map voor de badge is het
minimale, bestaand-patroon-conforme middel. De CHECK-constraint staat ook
`agent` en `voice` toe (`supabase/migrations/013_risico_analyse_type.sql:12`),
maar de UI kent alleen de twee types; geen fallback-tabel voor types die niet
voorkomen (constitution VI).

**Alternatives considered**:
- Centrale `src/lib/labels.ts` — afgewezen: één gebruikspunt; geen
  speculatieve generalisatie.
- Emoji's in de badge overnemen uit `ASSISTANT_TYPES` — afgewezen: de spec
  specificeert exact "Chat" en "Risico-analyse".

## 4. Alleen actieve assistenten voor members

**Decision**: Filter in `AssistantsPage.tsx` (client-side op de reeds opgehaalde
lijst: `isAdmin ? all : all.filter(a => a.is_active)`). De queryhook
`useAssistants` (`src/hooks/queries.ts:36-44`) wordt niet gewijzigd.

**Rationale**: Leesrechten binnen de organisatie blijven bestaan (FR-009) — de
data wordt dus wél geladen. Het filter is puur een UI-zichtbaarheidszaak.
De hook wordt mogelijk door andere componenten gebruikt; een filter in de hook
zou bijwerkingen elders kunnen veroorzaken. De bestaande "Inactief"-badge
(`AssistantsPage.tsx:93`) en `opacity-60`-styling (`:85`) blijven voor admins.

**Alternatives considered**:
- `.eq('is_active', true)` in de query met rol-conditional — afgewezen: rol
  is geen argument van de hook; twee codepaden in de hook is meer ingreep dan
  een filter op de renderlocatie.
- RLS-filter (members zien inactieve rijen niet) — afgewezen: de opdracht
  schrijft leestoegang binnen de eigen organisatie expliciet voor (FR-009),
  en per-assistent-rechten zijn buiten scope.

## 5. System prompt in de UI

**Decision**: Alleen de kaart-fallback `a.description || a.system_prompt`
(`AssistantsPage.tsx:100`) vervangen door `a.description ?? ''`. Verder
toont de UI de systeeminstructie nergens — ook niet aan admins — en dat
blijft zo. Geen systeeminstructie-veld toevoegen aan de admin-modal.

**Rationale**: Verificatie leerde dat de bewerkmodal géén
systeeminstructie-veld heeft; bij update wordt de bestaande waarde onzichtbaar
doorgestuurd (`AssistantsPage.tsx:215`). De chat-UI toont alleen naam, icoon en
omschrijving (`AssistantsPage.tsx:591-594`). De spec-aanname "de
systeeminstructie blijft in het bewerkformulier voor beheerders zichtbaar en
bewerkbaar" is daarmee onjuist over de huidige stand; bijgewerkt in de spec
(Assumptions): de UI toont de systeeminstructie aan niemand en dit blijft
ongewijzigd — aanpassen gebeurt niet via de UI maar via directe data-toegang
(read-recht blijft voor alle org-leden; FR-005 blijft correct: aan members
wordt de systeeminstructie nergens getoond).

**Alternatives considered**:
- Systeeminstructie-veld toevoegen aan de admin-modal — afgewezen: niet
  gevraagd (constitution VI), vergroot de blootstelling van interne
  configuratie.

## 6. RLS-hardening: welke policies wijzigen

**Decision**: Eén migratie `supabase/migrations/015_admin_only_writes.sql`:
nieuwe helper `is_org_admin()` (patroon volgt `get_user_org_id()`,
`001_initial_schema.sql:171-174`) en per tabel worden de bestaande permissive
schrijf-policies vervangen door admin-only-versies (DROP + CREATE). SELECT
blijft overal org-gebaseerd. Details en exacte voor/na-matrix:
[data-model.md](data-model.md).

**Rationale** (blauwdruk uit de migraties):

| Tabel | Policies nu (permissive, org-based) | Te vervangen |
|---|---|---|
| `ai_assistants` | `001_initial_schema.sql:218-228` | INSERT, UPDATE, DELETE → admin-only |
| `knowledge_bases` | `001_initial_schema.sql:235-245` | INSERT, UPDATE, DELETE → admin-only |
| `knowledge_base_documents` | `007_multitenancy_hardening.sql:221-227` | INSERT, DELETE → admin-only (UPDATE heeft nu al geen policy = deny) |
| `knowledge_items` | `002_rag_assistant_management.sql:101-116` | INSERT, DELETE → admin-only (UPDATE al geen policy) |
| `assistant_knowledge_bases` | `007_multitenancy_hardening.sql:157-186` | INSERT, DELETE → admin-only |
| `storage.objects` (bucket `knowledge-documents`) | `007_multitenancy_hardening.sql:83-121` | INSERT, UPDATE, DELETE → admin-only (SELECT/org-read blijft) |

Belangrijk voor de correctheid: documentstatus-overgangen
(`processing → ready/error`) en embeddingstatus worden níet door de client
geschreven — er bestaat geen client-update op die tabellen; de status wordt
door de n8n-flow/Darwin API gezet (service role, omzeilt RLS). Admin-functionaliteit
breekt dus niet. De client-mutatiehooks (`src/hooks/queries.ts:298-517`) worden
alleen door admin-UI bestuurd; na de migratie weigert RLS ze voor members met
een getoonde foutmelding (constitution V, bestaande error-afhandeling).

Storage-UPDATE meenemen is bewust (niet in de opdracht genoemd): zonder die
hardening kan een member een bestaand document overschrijven via
`storage.update` en daarmee de upload-weigering omzeilen — hetzelfde gat via
een andere operatie. Zie [contracts/permissions-matrix.md](contracts/permissions-matrix.md).

**Alternatives considered**:
- Inline `EXISTS (SELECT 1 FROM profiles … role = 'admin')` in elk van de 15+
  policies (patroon uit `001_initial_schema.sql:192-211` invitations) —
  afgewezen: 15+ duplicaties; de helper is het bestaande function-patroon
  (`get_user_org_id()`) en blijft hergebruikbaar en testbaar.
- Column-level privileges / triggers — afgewezen: RLS is het platformpatroon
  (constitution: RLS op elke tabel) en policies zijn auditeerbaar per rol.

## 7. Testaanpak

**Decision**:
1. `tests/e2e/fixtures.ts`: member-fixture met `E2E_MEMBER_EMAIL` /
   `E2E_MEMBER_PASSWORD` (skip met reden als afwezig — zelfde patroon als de
   bestaande fixture `:11-24`; het reeds aanwezige `test.skip`-gemis wordt
   daarmee opgelost, `flow-config.spec.ts:141-146`).
2. Nieuw `tests/e2e/admin-only-management.spec.ts`: UI-gating met REST-mocks
   via `page.route` (bestaand patroon) — member ziet alleen actieve
   assistenten met leesbare labels, geen beheerbesturing in de DOM (query op
   knoppen/aria-labels levert niets), kennisbronnen read-only; admin behoudt
   alles inclusief "Inactief"-badge.
3. Nieuw `scripts/rls-verify.mjs`: Node-script dat met supabase-js inlogt als
   member en de 15 schrijfcombinaties + storage upload/delete rechtstreeks
   tegen de live database test (SC-001/SC-002), plus positieve checks
   (lezen binnen org, eigen gesprek/bericht/feedback schrijven lukt). Dit
   kan niet via gemockte `page.route` omdat het echte RLS-decisies test.

**Rationale**: De bestaande e2e-suite mockt alle Supabase-REST (`page.route`,
geen seeding); die aanpak kan RLS-gedrag niet bewijzen. Voor de
database-afdwang (user story 4, de kern van de feature) is een directe
data-laagtest nodig. Playwright-login via de member-fixture dekt de
toetsenbord/DOM-eisen (FR-004).

**Alternatives considered**:
- RLS-checks alleen handmatig via SQL/curl na deploy (patroon 009-quickstart) —
  afgewezen als énige dekking: SC-001 vraagt geautomatiseerde tests; het script
  is herhaald uitvoerbaar (ook na toekomstige migraties).
- Playwright-test die live Supabase raakt — afgewezen: de suite draait
  volledig gemocked en parallel; een live-dependency verstoort dat patroon.