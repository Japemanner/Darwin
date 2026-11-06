# Implementation Plan: Assistenten verwijderen uit de AI-assistentenlijst

**Branch**: `023-delete-assistants` | **Date**: 2026-11-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/023-delete-assistants/spec.md`. De
gebruiker heeft de openstaande vraag beantwoord: verwijderen is **archiveren**;
bestaande gesprekken en analyses blijven leesbaar en de platformbeheerder kan de
assistent later herstellen.

## Summary

De platformbeheerder krijgt op **AI-assistenten** per assistent een verwijderknop en
een bevestigingsvenster. Verwijderen archivet de assistent voor alle organisaties:
de catalogusrij en elke organisatierij krijgen een `archived_at`-tijdstip, maar
gesprekken, berichten, analyses, feedback en kennisbronkoppelingen blijven bestaan.
De assistent verdwijnt uit AI-assistenten, het startscherm, de geschiedenis, de
schakelaars in Instellingen en het venster Koppelingen; `rag-chat` en
`analysis-run-submit` weigeren hem. Een aparte **Archief**-knop opent de lijst met
verwijderde assistenten; **Herstellen** maakt de assistent weer beschikbaar met
dezelfde aan/uit-stand per organisatie. Nieuwe organisaties die tijdens het archief
zijn aangemaakt, krijgen de assistent na herstel **uit**.

De opslag is additief: `assistant_catalog.archived_at` is de bron van waarheid,
`ai_assistants.archived_at` is de denormalisatie waarmee bestaande queries blijven
werken. Twee `SECURITY DEFINER`-functies doen archiveren en herstellen in één
transactie; de `platform-admin` Edge Function krijgt drie nieuwe acties en scherpt
vijf bestaande acties aan. De frontend krijgt twee kleine componenten, een typed
client en hooks; de gedeelde `Dialog` leert de focus terugzetten.

## Technical Context

**Language/Version**: TypeScript 5.6 / React 18.3 / Vite 6 (frontend); Deno +
TypeScript (Supabase Edge Functions).

**Primary Dependencies**: bestaand — `@supabase/supabase-js` v2 (PostgREST,
`functions.invoke`, `rpc`), TanStack Query v5, Tailwind 3 + shadcn/ui,
`lucide-react`, Playwright. **Geen nieuwe dependencies.**

**Storage**: Supabase Postgres. Geen Storage-buckets of bestanden betrokken. De
nieuwe kolommen staan op `public.assistant_catalog` en `public.ai_assistants`;
gesprekken, berichten, `analysis_runs`, `feedback_interactions` en
`assistant_knowledge_bases` blijven ongewijzigd.

**Testing**: Playwright. Nieuw `tests/e2e/assistant-archive.spec.ts` met gemockte
`platform-admin`- en `ai_assistants`-responses voor de UI-flows (verwijderen,
annuleren, archief, herstellen, geen besturing voor kantoorbeheerders). De echte
database- en autorisatiepaden worden volgens [quickstart.md](quickstart.md)
handmatig gecontroleerd met SQL en directe functieaanroepen. `tsc --noEmit`,
`eslint src/ --max-warnings 0` en `npm run build` moeten groen zijn.

**Target Platform**: Web (Netlify) + Supabase (Postgres, Edge Functions).

**Project Type**: web-app met een server-side Supabase-component.

**Performance Goals**: Archiveren en herstellen doen één `UPDATE` over alle
organisatierijen van één assistent (nu 6 rijen, ontwerp voor tientallen). De
lijstqueries krijgen een `archived_at IS NULL`-filter op een nieuwe index
`(organization_id, archived_at)`; er is geen meetbare verslechtering voor chat of
analyse. Geen nieuwe polling of achtergrondtaak.

**Constraints**:

- Verwijderen verwijdert geen gesprekken, berichten, analyses, feedback of
  kennisbronkoppelingen (spec FR-007/FR-008, constitution III).
- Alleen de platformbeheerder mag archiveren en herstellen; de server weigert
  andere rollen met 403 en anoniem met 401.
- Archiveren en herstellen zijn alles-of-niets; de RPC's draaien in één transactie.
- `is_active` per organisatie blijft ongewijzigd bij archiveren en herstellen.
- Nieuwe organisaties krijgen nooit een gearchiveerde assistent en krijgen een
  herstelde assistent uit.
- UI-teksten Nederlands in de u-vorm; code, identifiers en commits Engels
  (constitution I).
- WCAG 2.1 AA: toetsenbordbediening, zichtbare focus, focusbehoud en -terugkeer,
  toegankelijke namen (constitution IV).
- Geen geheimen of service-role keys in de frontend; al het bevoorrechte werk in de
  Edge Function (constitution/AGENTS.md).
- Logs bevatten alleen code, actie, id's en duur; geen namen, URL's, tokens of
  cliëntinhoud (constitution III).
- Geen migratie toepassen of functie deployen zonder expliciete bevestiging in de
  chat; daarna via de Supabase MCP.
- Releasevolgorde: migratie 024 → `platform-admin` deployen → frontend.

**Scale/Scope**: 1 migratie (`024_assistant_archive.sql`), 3 gewijzigde Edge
Functions (`platform-admin`, `rag-chat`, `analysis-run-submit`), 2 nieuwe
frontend-componenten, 5 gewijzigde frontend-bestanden (inclusief de gedeelde
dialoog en de types), 1 nieuwe Playwright-spec. Geen nieuwe dependencies, geen
nieuwe route, geen RLS-wijziging.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Status | Toelichting |
|---|------|--------|-------------|
| 1 | Dutch UI copy, u-vorm (Principle I) | PASS | Nieuwe teksten: "Verwijderen", "Weet u zeker dat u … wilt verwijderen?", "Annuleren", "Archief", "Herstellen", "Assistent verwijderd", "Assistent hersteld", de lege toestand en de foutmeldingen. Code, identifiers, comments en commits blijven Engels. |
| 2 | Concept, never advice (Principle II) | PASS | De feature raakt geen antwoorden, resultaten of het CONCEPT-label. Archiveren verwijdert geen uitkomsten en voegt geen advies toe. |
| 3 | Client data sensitivity (Principle III) | PASS | Gesprekken, berichten, analyses en dossiers worden niet gelezen, gewijzigd of verwijderd. De RPC's raken alleen `archived_at`. Logs bevatten alleen id's, actie, code en duur. Geen cliëntinhoud in URL's, PostHog of browseropslag. |
| 4 | Accessibility WCAG 2.1 AA (Principle IV) | PASS | Verwijder- en herstelknop krijgen een toegankelijke naam met de assistentnaam; het bevestigingsvenster opent met focus op "Annuleren", houdt de focus vast en geeft hem terug aan de opener. Na een geslaagde verwijdering gaat de focus naar "Archief". De archieflijst is met het toetsenbord te doorlopen en heeft een lege toestand. |
| 5 | Typed external clients, no silent failures (Principle V) | PASS | `platform-admin-client.ts` krijgt getypeerde `ArchivedAssistant`-interfaces en drie functies; bestaande `PlatformAdminClientError` mapt 400/401/403/500 naar Nederlandse meldingen. Elke mislukte archiveer- of herstelactie toont een toast en laat de lijst intact. |
| 6 | Minimal scope (Principle VI) | PASS | Alleen archiveren/herstellen zoals gevraagd en door de gebruiker gekozen. Geen bulkactie, geen bewaartermijn, geen definitieve purge, geen nieuwe route, geen nieuwe dependency, geen bredere RLS-wijziging. |
| 7 | Security & data protection constraints | PASS | RLS blijft op beide tabellen aan; `assistant_catalog` blijft volledig afgeschermd en wordt alleen met de service role gelezen. De nieuwe RPC's zijn alleen voor `service_role` uitvoerbaar. Geen secrets in de bundle. |

**Re-check na Phase 1 (design): PASS** — het ontwerp voegt alleen toe wat nodig is:
(a) de dubbele `archived_at`-opslag voorkomt dat geschiedenisembeds breken zonder
RLS te verruimen (#2/#3); (b) de RPC's garanderen atomiciteit en één waarheid voor
de archiefstatus (#4); (c) de archieflijst via de bestaande beheerroute voorkomt
een nieuwe publieke leesroute (#5); (d) de focusfix in de gedeelde `Dialog` is
beperkt tot de bestaande focusafhandeling en nodig voor FR-002/SC-005 (#7).

## Project Structure

### Documentation (this feature)

```text
specs/023-delete-assistants/
├── plan.md                          # Dit bestand
├── research.md                      # Phase 0: 9 beslissingen (archief, opslag, RLS,
│                                    #   atomiciteit, beheerroute, serverchecks, UI,
│                                    #   tests, migratie/typen)
├── data-model.md                    # Phase 1: kolommen, relaties, RPC's,
│                                    #   toestandsovergangen, invarianten, querymatrix
├── quickstart.md                    # Phase 1: migratie, deploy, acceptatie,
│                                    #   negatieve controles, rollback, release
├── contracts/
│   └── platform-admin-archive.md    # Phase 1: nieuwe en gewijzigde acties
├── checklists/
│   └── requirements.md              # Spec-quality-checklist (uit /speckit.specify)
└── tasks.md                         # /speckit.tasks (nog niet aangemaakt)
```

### Source Code (repository root)

```text
supabase/
├── migrations/
│   └── 024_assistant_archive.sql    # NIEUW: archived_at op catalogus en
│                                    #   organisatierijen, index, archive/restore-RPC's,
│                                    #   seedfunctie slaat gearchiveerde catalogusrijen over
└── functions/
    ├── platform-admin/index.ts      # 3 nieuwe acties; filters in list_org_assistants,
    │                                #   get_connections, save_connections,
    │                                #   set_assistant_active, save_catalog_assistant
    ├── rag-chat/index.ts            # archived_at selecteren en weigeren
    └── analysis-run-submit/index.ts # archived_at selecteren en weigeren

src/
├── components/
│   ├── assistants/
│   │   ├── DeleteAssistantDialog.tsx  # NIEUW: bevestiging, wachtstand, toast
│   │   └── ArchiveDialog.tsx          # NIEUW: archieflijst, lege toestand, herstellen
│   └── ui/dialog.tsx                  # focus terug naar de opener bij sluiten
├── hooks/queries.ts                   # archieffilters, archiefquery, twee mutaties
├── lib/platform-admin-client.ts       # ArchivedAssistant + 3 getypeerde functies
├── pages/AssistantsPage.tsx           # verwijderknop, Archief-knop, focus na verwijderen
└── types/database.types.ts            # ai_assistants.archived_at (Row/Insert/Update)

tests/e2e/
└── assistant-archive.spec.ts          # NIEUW: UI-flows met gemockte REST/functie
```

**Structure Decision**: de bestaande structuur blijft. De feature voegt één
additieve migratie, twee kleine featurecomponenten en één E2E-spec toe, wijzigt de
bestaande beheerfunctie, twee bestaande Edge Functions, drie frontend-bestanden en
de gedeelde dialoog. Er komt geen nieuwe route, pagina, tabel of dependency.

## Ontwerp in het kort

### Migratie 024

Volgt [data-model.md](data-model.md) §7:

1. `assistant_catalog.archived_at timestamptz NULL`.
2. `ai_assistants.archived_at timestamptz NULL`.
3. Index `ai_assistants_organization_archived_idx (organization_id, archived_at)`.
4. `platform_archive_catalog_assistant(p_id uuid)` en
   `platform_restore_catalog_assistant(p_id uuid, p_actor uuid)`:
   `SECURITY DEFINER`, `search_path = public`, `EXECUTE` alleen voor
   `service_role`.
5. `platform_seed_org_assistants` vervangen met
   `WHERE c.archived_at IS NULL`, zodat `create-tenant` nooit een gearchiveerde
   assistent zaait.
6. Geen backfill: alle bestaande rijen beginnen met `archived_at = NULL`.

### `platform-admin`

Volgt [contracts/platform-admin-archive.md](contracts/platform-admin-archive.md):

- **Nieuw**: `list_archived_assistants` (catalogus, `archived_at` aflopend),
  `archive_catalog_assistant`, `restore_catalog_assistant`.
- **Aangescherpt**: `list_org_assistants` en `get_connections` filteren
  `archived_at IS NULL`; `save_connections` weigert een gearchiveerde
  `catalog_id`; `set_assistant_active` raakt alleen niet-gearchiveerde rijen;
  `save_catalog_assistant` weigert een gearchiveerde id.
- **Foutmapping**: `not_found` → "Deze assistent bestaat niet meer.",
  `already_archived` → "Deze assistent is al verwijderd.", `not_archived` →
  "Deze assistent is niet verwijderd."; overige fouten → `INTERNAL_ERROR`.
- **Logging**: alleen `code`, `action`, `catalog_id` en duur.

### `rag-chat` en `analysis-run-submit`

- Beide selecteren `archived_at` op `ai_assistants`.
- Een gezette `archived_at` valt in de bestaande `FORBIDDEN`-route, vóór er iets
  wordt opgeslagen of naar n8n verstuurd.
- `analysis-run-submit` houdt de bestaande controles op `is_active`, type en
  organisatie.

### Frontend

- `platform-admin-client.ts`: `ArchivedAssistant`, `listArchivedAssistants()`,
  `archiveCatalogAssistant(catalogId)`, `restoreCatalogAssistant(catalogId)`.
- `queries.ts`:
  - `.is('archived_at', null)` in `useAssistants`, `useAssistantOptions`,
    `useAssistant` en de assistententelling van `useDashboardCounts`;
  - `useLinkedAssistants` filtert gearchiveerde rijen uit de join;
  - `useArchivedAssistants(enabled)` met querykey `['archived-assistants']`;
  - `useArchiveAssistant(orgId)` en `useRestoreAssistant(orgId)` invalideren
    `['assistants']`, `['archived-assistants']` en `['dashboard-counts', orgId]`.
- `AssistantsPage.tsx`: alleen voor de platformbeheerder een prullenbak-knop per
  kaart (`aria-label="<naam> verwijderen"`) en een **Archief**-knop in de kop.
- `DeleteAssistantDialog.tsx`: titel "Assistent verwijderen", waarschuwing met
  naam, "voor alle organisaties", "gesprekken en analyses blijven leesbaar" en
  "herstel via het archief"; **Annuleren** staat eerst en krijgt de focus,
  **Verwijderen** is destructief en toont "Verwijderen…" tijdens opslaan. Bij
  succes sluit het venster, verschijnt de toast en gaat de focus naar **Archief**.
- `ArchiveDialog.tsx`: haalt de lijst op bij openen, toont icoon, naam, typelabel en
  de Nederlandse verwijderdatum, een **Herstellen**-knop per rij met toegankelijke
  naam, een laadstand, een Nederlandse foutmelding met de mogelijkheid opnieuw te
  openen, en de lege toestand "Geen verwijderde assistenten".
- `Dialog` (gedeeld): onthoudt het element dat bij openen focus had en zet de focus
  daar bij sluiten naar terug als het nog in het document staat. Dit maakt de
  bestaande en nieuwe vensters toetsenbordvriendelijk zonder dubbele logica. Leg
  de opener vast bij de open-transitie (niet bij elke render) en geef beide nieuwe
  vensters een stabiele `onOpenChange` (een state-setter), zodat een re-render de
  focus niet terugzet naar het eerste bedieningselement.

### Typen

- `src/types/database.types.ts`: `archived_at: string | null` toevoegen aan
  `ai_assistants.Row`, `Insert` (optioneel) en `Update` (optioneel).
- Geen `assistant_catalog`-type nodig: de archieflijst wordt getypeerd in
  `platform-admin-client.ts`.

### Tests

- `tests/e2e/assistant-archive.spec.ts` (gemockt, geen productiedata):
  1. platformbeheerder ziet de verwijderknop; het venster toont de naam en de
     gevolgen; **Annuleren** laat de kaart staan;
  2. bevestigen stuurt `archive_catalog_assistant`, verwijdert de kaart en toont de
     bevestiging;
  3. **Archief** toont een gemockte gearchiveerde assistent; **Herstellen** stuurt
     `restore_catalog_assistant` en werkt de lijst bij;
  4. een kantoorbeheerder ziet geen verwijderknop en geen **Archief**-knop.
- Bestaande `platform-admin.spec.ts` blijft ongewijzigd groen; de bestaande
  assertie dat een kantoorbeheerder geen "Verwijderen" ziet, blijft gelden.
- `tsc --noEmit`, `eslint src/ --max-warnings 0`, `npm run build` en de volledige
  Playwright-suite moeten groen zijn.

## Aandachtspunten en risico's

- **Volgorde**: de kolommen moeten bestaan voordat de nieuwe `platform-admin`
  functie draait; de frontend mag pas daarna live. Quickstart §1–§3 dwingt dit af.
- **Zichtbaarheid versus RLS**: gearchiveerde definities blijven voor de eigen
  organisatie leesbaar, net als uitgezette assistenten nu. De bruikbaarheid wordt
  server-side geweigerd; de UI biedt ze nergens aan. Dit is bewust en vastgelegd in
  research #3.
- **Geschiedenis**: `useConversation` en `useConversations` blijven ongewijzigd,
  zodat naam en icoon van een gearchiveerde assistent in oude gesprekken zichtbaar
  blijven.
- **Geen dataverlies**: archiveren en herstellen raken alleen `archived_at`; de
  quickstart vergelijkt de rij aantallen van gesprekken, berichten, analyses en
  koppelingen vóór en na.
- **Testdata**: de E2E-spec mockt de beheerfunctie, zodat de suite geen echte
  assistent tijdelijk verbergt. De echte route staat in quickstart §5.
- **Focus na verwijderen**: de verwijderknop verdwijnt met de kaart; de pagina zet
  de focus daarom op **Archief**. Bij annuleren of sluiten gaat de focus terug naar
  de knop die het venster opende.

## Complexity Tracking

> Geen constitution-schendingen. Er zijn geen afwijkingen die rechtvaardiging
> vragen.

| Afwijking | Waarom nodig | Simpeler alternatief verworpen omdat |
|---|---|---|
| — | — | — |
