# Research: Risico-analyse als eigen pagina, met soepelere invoer

**Date**: 2026-10-30 | **Feature**: [spec.md](spec.md) | **Branch**: `014-risk-analysis-page`

Alle onbekenden zijn onderzocht in de codebase (`src/components/analysis/AnalysisFlow.tsx`,
`AnalysisForm.tsx`, `RunCard.tsx`, `ResultView.tsx`, `RecentRunsPanel.tsx`,
`src/pages/AssistantsPage.tsx`, `src/pages/ChatPage.tsx` (pagina-patroon),
`src/components/layout/AppShell.tsx`, `src/App.tsx`, `src/hooks/useAnalysisRun.ts`,
`useRecentRuns.ts`, `src/hooks/useAuth.ts`, `src/lib/analysis-client.ts`,
`src/lib/analysis-schemas.ts`, `src/store/authStore.ts` (zustand-patroon),
`scripts/mock-analysis-server.mjs`, `index.html`, `tests/e2e/analysis-form.spec.ts`,
`analysis-run.spec.ts`, `analysis-jwt.spec.ts`, `tests/e2e/fixtures.ts`,
`playwright.config.ts`, `specs/008-risico-analyse-ui/contracts/run-status.md`) en
tegen de constitution. Geen onopgeloste NEEDS CLARIFICATION. Bevindingen per beslissing.

## 1. Routes en pagina's — id-only adressen in de bestaande AppShell-layout

**Decision**: twee nieuwe routes in `src/App.tsx` (lazy, zoals ChatPage):
`/analyse/new/:assistantId` (formulier + recente analyses) en `/analyse/:runId`
(RunCard + ResultView). Nieuwe pagina's `src/pages/AnalysisNewPage.tsx` en
`src/pages/AnalysisRunPage.tsx` binnen de bestaande `AppShell`-layout (net als
`/chat/...`). `AnalysisFlow.tsx` (het zijpaneel) verdwijnt volledig; de kaartknop
"Risico-analyse starten" op `AssistantsPage` navigeert naar `/analyse/new/:id`.

**Rationale**: beide adressen bevatten uitsluitend uuid's (assistent-id, run-id) —
klantreferenties of inhoud komen nooit in de URL (constitution III, FR-002; ook het
bestaande e2e bewaakt dit al: `analysis-form.spec.ts:68`, `analysis-jwt.spec.ts:45`).
De AppShell-layout geeft bovendien gratis wat het paneel miste: de zijbalk (en daarmee
de badge uit US2) blijft zichtbaar op de analysepagina's.

**Alternatives considered**:
- Zijpaneel behouden met eigen adres erin — afgewezen: route schrijft eigen pagina's
  voor; het paneel is de oorzaak van het "sluiten = alles kwijt"-probleem.
- `/analysis/...` i.p.v. `/analyse/...` — de route schrijft Nederlands (`/analyse/`),
  consistent met de bestaande Nederlandse UI-taal en zonder botsende route.

## 2. Retry-snapshot: Map blijft in-memory; plus een `hadBestanden`-vlag

**Decision**: de module-level `Map` `retrySnapshots` (nu in `AnalysisFlow.tsx:22`)
verhuist naar een nieuw klein modulebestand `src/lib/analysis-retry.ts` (export van
de Map + helperfuncties). De snapshot krijgt één extra veld:
`hadBestanden: boolean` (of de mislukte poging bijlagen had). Bij "Opnieuw" navigeert
`AnalysisRunPage` naar `/analyse/new/:assistantId` met `router state { retryRunId }`
(memory-only, niet in de URL).

**Rationale**: `AnalysisNewPage` (schrijft de snapshot bij submit) en
`AnalysisRunPage` (leest bij retry) delen de snapshot dus moet die buiten de te
verwijderen AnalysisFlow wonen. De bijlagen zelf blijven bewust weg (constitution III:
geen klantinhoud buiten de sessie; File-objects hergebruiken zou ook misleidend zijn
na een mislukte upload) — de US5-melding heeft alleen het feit nodig, niet de
bestanden: daarom de boolean vlag. `location.state` is router-geheugen, geen URL —
verversen van `/analyse/new` verliest de prefill (net als vandaag: "De eerdere invoer
is niet meer beschikbaar in deze sessie", `AnalysisFlow.tsx:145-149` — bestaand,
onveranderd gedrag).

**Alternatives considered**:
- Bestanden mee in de Map bewaren (in-memory File objects) — afgewezen: spec US5
  kiest expliciet voor de melding i.p.v. bewaren; ook dan zou de melding verdwijnen
  en de adviseur toch ongemerkt oude bestanden hergebruiken.
- Snapshot in sessionStorage — afgewezen: klantgevoelige formulierinhoud
  (vraagstuk, klantsituatie) hoort niet in browseropslag (constitution III); de
  Map blijft like the huidige code in-memory.

## 3. Zijbalkindicator: één gedeelde query met conditionele interval

**Decision**: nieuwe hook `src/hooks/useAnalysisNotifications.ts` op basis van
`fetchRecentRuns`, hergebruikend het bestaande `queryKey ['analysis-recent-runs',
advisorId]` uit `useRecentRuns` — en `useRecentRuns` krijgt een conditionele
`refetchInterval`: 10 s zolang de geladen lijst runs met status `queued`/`running`
bevat, anders `false` (geen polling). De indicatorhook berekent daaruit het aantal
afgeronde-ongeziene runs en de badge/tabbladtitel gebruiken dat.

**Rationale**: één queryKey = badge (overal actief) en lijst (op de analysepagina)
delen één request en één interval; de acceptatie-eis "de statusindicator pollt alleen
zolang er lopende analyses zijn" geldt dan in één punt. TanStack Query stopt
interval-refetch bovendien automatisch zodra er geen waarnemers meer zijn — buiten de
AppShell bestaat die altijd, dus de conditionele functie is de juiste plek. De run-page
pollt ongewijzigd via `useAnalysisRun` (3 s, stopt bij succeeded/failed —
`useAnalysisRun.ts:18-22`).

**Alternatives considered**:
- Aparte queryKey voor de indicator — afgewezen: twee identieke requests zolang de
  lijst gemount is; en de eis zou op twee plaatsen afgedwongen moeten worden.
- `useRecentRuns` ongemoeid laten (10 s altijd) — afgewezen: de lijst op
  `/analyse/new` zou dan pollen zonder dat er iets loopt, tegen de geest van het
  acceptatiecriterium; één conditionele interval dekt beide af.

## 4. 'Gezien'-registratie: zustand + sessionStorage, alleen run-id's

**Decision**: nieuwe store `src/store/analysisSeenStore.ts` (zustand, patroon van
`authStore.ts`) met `seenIds: string[]` + `initialized: boolean`, gepersisteerd naar
**sessionStorage** (alleen run-id's, geen inhoud — expliciete route-instructie,
constitution III-conform want sessiegebonden). `markSeen(ids)` voegt toe en kapt af
op de laatste 50 id's (begrensde groei). De badge-telling =
`succeeded/failed`-runs wier id niet in de set zit.

**Rationale**: de route schrijft sessionStorage voor; sessionStorage is
sessiegebonden (vervallen bij sluiten van het tabblad) en bevat uitsluitend
uuid's — geen klantinhoud. zustand is een bestaande dependency en beide consumenten
(AppShell-badge, pagina's die markeren) importeren dezelfde store — geen
prop-drilling.

**Alternatives considered**:
- Server-kolom "laatst bekeken" op het profiel — afgewezen: route schrijft
  sessionStorage; server-opslag is een grotere wijziging (migratie) dan de scope
  toestaat.
- localStorage — afgewezen: overleeft de sessie; constitution III zegt "beyond the
  active session" verboden.

**Geaccepteerde trade-off (route-keuze)**: sessionStorage is per tabblad. Een nieuw
tabblad start met een lege "gezien"-set; de eerste-initialisatieregel (zie #5) zorgt
ervoor dat zo'n tabblad niet oude afrondingen als nieuw telt — "sinds mijn laatste
bezoek" geldt binnen de sessie van het tabblad. Expliciete route-instructie, genoteerd
in de spec-aannames.

## 5. Eerste gebruik en reset-semantiek van de telling

**Decision**: twee regels in `useAnalysisNotifications`:
(a) **Eerste initialisatie**: zodra de lijst voor het eerst geladen is terwijl de
store nog `initialized === false` staat, worden álle huidige `succeeded`/`failed`
runs gemarkeerd als gezien (spec edge case: analyses van vóór de eerste sessie
tellen niet) en zet de vlag op true (meegepersisteerd).
(b) **Bekijken = markeren**: `AnalysisNewPage` markeert bij (her)laden alle
afgeronde runs in de lijst als gezien; `AnalysisRunPage` markeert de run zodra die
`succeeded`/`failed` is (ook als dat tijdens het kijken gebeurt). Elders in de app
wordt niets gemarkeerd — `/assistants` bekijken reset de telling dus níet.

**Rationale**: zonder (a) zou een eerste login direct "10" tonen voor jarenoude
runs. Zonder (b) zou een run die afloopt terwijl de adviseur ernaar kijkt toch een
badge geven — hij heeft hem immers gezien.

**Alternatives considered**:
- Timestamp "laatst bekeken" i.p.v. id-set — afgewezen: races tussen tabbladen en
  afrondingen precies op de grens; de id-set is deterministisch en matcht de
  route-instructie.

## 6. Badge en tabbladtitel

**Decision**: `AppShell` gebruikt `useAnalysisNotifications(profile?.id)`. De badge
verschijnt in de zijbalk bij het menu-item **Assistenten** — in béíde nav-renders
(desktop + mobiel, `AppShell.tsx:20-28` gedeelde `navItems`): een klein pill-cijfer
met toegankelijke naam ("n analyses klaar of mislukt sinds uw laatste bezoek"), alleen
bij n > 0 (geen "0"). `document.title`: bij n > 0 `(n) Darwin`, anders terug naar de
basis-titel `Darwin - AI Platform` (`index.html:6`) — gemeten bij mount, niet
gehardcodeerd, zodat een toekomstige titelwijziging intact blijft.

**Rationale**: de route plaatst de badge expliciet bij Assistenten (van daaruit
start je analyses); het cijfer is tekst, geen kleur-only signaal (WCAG, FR-016). De
tabbladtitel bevat uitsluitend het aantal — nooit een klantreferentie (constitution
III, FR-005).

**Alternatives considered**:
- Nieuw zijbalk-item "Analyses" met badge — afgewezen: de route kiest Assistenten;
  een extra navigatie-item is scope-uitbreiding (constitution VI).

## 7. `expires_at` in de lijst: optioneel in het schema, verplicht in de mock

**Decision**: `RecentRunSchema` (`analysis-schemas.ts:55-63`) krijgt
`expires_at: z.string().datetime().nullable().optional()`. De mockservers
`publicRecent` levert het veld (`run.expires_at` bestaat al, `mock-analysis-server.mjs`).
De contractwijziging wordt genoteerd in `specs/008-risico-analyse-ui/contracts/run-status.md`.
`RecentRunsPanel` toont bij `succeeded`-runs mét `expires_at`: "beschikbaar tot
dd-mm-jjjj" (`toLocaleDateString('nl-NL')`).

**Rationale**: `fetchRecentRuns` slaat elk item dat de zod-parse níet haalt stilletjes
over (`analysis-client.ts:214-218`). Een verplicht veld zou bij een backend die het
nog niet levert de hele lijst leeg maken — een stille fout (constitution V). Optioneel
is achterwaarts compatibel: frontend eerst, backend daarna, en de lijst intact in
beide volgorden. De display-eis ("beschikbaar tot") geldt alleen bij een geslaagde
run mét veld — spec-aanname "geen vervaldatum zonder resultaat".

**Alternatives considered**:
- Verplicht veld + backend eerst deployen — afgewezen: breekraam bij verkeerde
  volgorde; de lijst valt leeg zonder foutmelding.
- `fetchRecentRuns` de parse-fout laten tonen — buiten route; het zwijgen geldt
  alleen voor individuele afwijkende items (bestaand, bewust patroon).

## 8. Formuliervolgorde, standaardselectie en teksten

**Decision**: `AnalysisForm.tsx` herschikt naar: Klantreferentie, Verzekeringsvraagstuk,
Kennisbronnen, Klantsituatie, Bestanden, URL's. Het Adviseur-invoerveld verdwijnt uit
het formulier; de naam komt als vaste tekst in de paginakop (`AnalysisNewPage`-header,
naast de assistent). Bij een néuw formulier (geen `initial`) zijn alle kennisbronnen
aangevinkt zodra de bronnenlijst geladen is (effect bij `availableKBs`-update); bij
retry geldt `initial.kennisbronnen` ongewijzigd (bestaand gedrag). Hulptekst wordt
"Standaard zijn alle kennisbronnen van deze assistent geselecteerd." (letterlijke
route-tekst). Placeholder Verzekeringsvraagstuk: "Bijvoorbeeld: de klant twijfelt of
een aansprakelijkheidsverzekering voor zijn eenmanszaak nodig is." (letterlijke
route-tekst). Alle bestaande validatieregels blijven ongewijzigd.

**Rationale**: de bronnenlijst komt asynchroon binnen (`useAssistantKnowledgeBases`),
dus "alles aangevinkt" is een effect op de datumsverandering, niet een initiële
constructor-state. De route-teksten zijn letterlijk voorgeschreven (constitution I:
NL, u-vorm-vrij maar feitelijk).

**Alternatives considered**:
- Standaardselectie in de query-hook — afgewezen: presentatielogica hoort bij het
  formulier; de hook is gedeeld met andere consumenten.

## 9. Bijlagen-melding bij "Opnieuw" op de pagina, niet in het formulier

**Decision**: `AnalysisNewPage` toont bij een retry-prefill waarvan snapshot
`hadBestanden === true` een amber `role="note"`-blok boven het formulier:
"Bijlagen zijn niet bewaard. Voeg de bestanden opnieuw toe." Het formuliercomponent
blijft generiek (geen extra prop).

**Rationale**: de melding is context van de retry-navigatie (pagina weet waarom ze
preFilled opent), niet van het formulier zelf; één bron van waarheid is de snapshot
(#2). Informatief, blokkeert niet (spec US5-3).

**Alternatives considered**:
- Melding ín `AnalysisForm` bij het bestandsonderdeel via extra prop — afgewezen:
  extra koppeling tussen pagina-state en formulierprops; de pagina-variant is
  kleiner en voldoet aan het route-item.

## 10. Slepen-en-neerzetten op het uploadvak

**Decision**: het bestaande uploadvak (het label "Bestanden kiezen" +
`sr-only`-input, `AnalysisForm.tsx:227-239`) wordt de dropzone: `onDragOver`
(`preventDefault` + visuele highlight-state) en `onDrop` (`preventDefault` +
`addFiles(e.dataTransfer.files)` — de bestaande controles op type/grootte en
foutmeldingen gelden ongewijzigd). De knop blijft bestaan als
toetsenbordalternatief (acceptatiecriterium).

**Rationale**: `addFiles` hergebruiken betekent identieke validatie en foutteksten
voor beide invoerwegen (spec US7-2). `preventDefault` op dragover/drop voorkomt dat
de browser het bestand opent. Geen nieuwe dependency — native events.

**Alternatives considered**:
- Aparte dropzone-bibliotheek — afgewezen: nieuwe dependency, tegengesteld aan de
  randvoorwaarden.

## 11. Niet-gevonden en geen-toegang op de runpagina

**Decision**: `AnalysisRunPage` behandelt `error.code === 'NOT_FOUND'` (bestaand:
`useAnalysisRun` doet géén retry op NOT_FOUND, `useAnalysisRun.ts:25`) met een nette
melding "Analyse niet gevonden" + teruglink — het patroon van ChatPage
("Gesprek niet gevonden", `ChatPage.tsx:259-267`). Overige fouten tonen de bestaande
Nederlandse clientfouten (constitution V).

**Rationale**: FR-004 eist een nette afhandeling zonder inhoud van anderen; de
client onderscheidt NOT_FOUND al.

## 12. Testimpact en nieuwe gevallen

**Decision**:
- **Aanpassen**: `analysis-form.spec.ts` — de knop navigeert nu naar
  `/analyse/new/:id`; de URL-assertie in het groepsvalidatiegeval wordt
  `/analyse/new/`; de `startAnalysis`-helpers navigeren mee. `analysis-run.spec.ts` —
  "survives navigation" keert terug via het run-adres (of de lijst op
  `/analyse/new/:id`) in plaats van via `/assistants`; het retry-geval komt op de
  nieuwe pagina terecht (asserties ongewijzigd qua inhoud). `analysis-jwt.spec.ts` —
  de recent-runs-call wordt nu óók door de AppShell-hook gedaan (op élke pagina), dus
  de intercept blijft werken; alleen de route-comment hoeft mee.
- **Nieuw**: `tests/e2e/analysis-notifications.spec.ts` — indicator: start een run
  (mock, ±10 s), navigeer naar `/knowledge`, wacht tot de badge "1" toont bij
  Assistenten en de titel "(1) Darwin" is; open daarna het run-adres → badge weg,
  titel terug naar de basis. De eerste-initialisatieregel (#5) maakt dit
  deterministisch: een verse context markeert bestaande afgeronde mock-runs als
  gezien, dus de badge telt precies de nieuwe afronding.
- **Nieuw in `analysis-form.spec.ts`**: Klantreferentie staat bovenaan (eerste label
  in het formulier) + placeholder zichtbaar bij leeg veld; alle kennisbronnen
  standaard aangevinkt; hulptekst vervangen.
- **Nieuw in `analysis-run.spec.ts`** (error-scenario): retry na een poging mét
  bestand toont de bijlagen-melding; zonder bestand geen melding.
- Bestaande `page.getByRole('checkbox').first().check()`-aanroepen blijven geldig:
  op een al aangevinkt vak is `check()` een no-op.

**Rationale**: acceptatiecriterium "bestaande analysis-specs blijven slagen,
aangepast aan de nieuwe routes"; route-item 6 noemt de drie nieuwe gevallen.

**Alternatives considered**:
- Alle nieuwe gevallen in één nieuw bestand — afgewezen: vorm- en retrygevallen
  horen bij de bestaande specs (context, mocks); alleen de indicator (eigen timing)
  krijgt een eigen bestand.