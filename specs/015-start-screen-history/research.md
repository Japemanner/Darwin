# Research: Startscherm rond de vraag en één overzicht van eerder werk

**Date**: 2026-10-30 | **Feature**: [spec.md](spec.md) | **Branch**: `015-start-screen-history`

Alle onbekenden zijn onderzocht in de codebase en tegen de constitution. Geraadpleegd:
`src/App.tsx`, `src/pages/CommandCenterPage.tsx`, `src/pages/HistoryPage.tsx`,
`src/pages/ChatPage.tsx`, `src/components/auth/LoginPage.tsx`,
`src/components/auth/ProtectedRoute.tsx`, `src/components/layout/AppShell.tsx`,
`src/hooks/queries.ts`, `src/hooks/useRecentRuns.ts`, `src/hooks/useAnalysisNotifications.ts`,
`src/lib/analysis-client.ts`, `src/lib/analysis-schemas.ts`, `src/lib/posthog.tsx`,
`src/store/analysisSeenStore.ts`, `src/components/ui/{tabs,select,textarea,input,empty-state,badge}.tsx`,
`src/components/analysis/RecentRunsPanel.tsx`, `scripts/mock-analysis-server.mjs`,
`specs/008-risico-analyse-ui/contracts/run-status.md`, `tests/e2e/*.spec.ts`,
`tests/e2e/fixtures.ts`, `playwright.config.ts`, `.specify/memory/constitution.md`.
Geen onopgeloste NEEDS CLARIFICATION.

## 1. Routes en doorverwijzingen — `/start` is de nieuwe landingspagina

**Decision**: voeg in `src/App.tsx` binnen de bestaande `ProtectedRoute` + `AppShell` de
route `/start` toe met lazy `StartPage`. Vervang de bestaande CommandCenter-route door
`<Route path="/command-center" element={<Navigate to="/start" replace />} />` en zet de
catch-all op `<Navigate to="/start" replace />`. Verwijder de lazy import en het bestand
`CommandCenterPage.tsx`. In `LoginPage.tsx` wordt de fallback
`localStorage.getItem('redirectAfterLogin') || '/start'`. In `AppShell.tsx` komt bovenaan
`{ href: '/start', label: 'Start', icon: Home }`; `Gauge` en de oude regel verdwijnen.

**Rationale**: de oude route blijft werken voor bladwijzers en externe links; de
catch-all stuurt onbekende paden naar het startscherm zoals de spec eist. `replace`
voorkomt een extra history-entry. De route ligt binnen de beveiligde layout, dus een
niet-ingelogde bezoeker gaat via `ProtectedRoute` naar `/login` en na inloggen terug naar
`/start` (of naar de oorspronkelijke diepe link).

**Alternatives considered**:
- `/` als startroute — afgewezen: de opdracht noemt expliciet `/start`; `/` valt onder de
  catch-all en komt zo ook op `/start` uit.
- `/command-center` als startpagina hergebruiken — afgewezen: de opdracht wil een nieuwe
  pagina en een expliciete doorverwijzing vanaf de oude route.

## 2. StartPage — drie bestaande queries, één vraagveld

**Decision**: `StartPage` gebruikt `useAssistants(profile?.organization_id)` voor de
assistenten, `useConversations(profile?.id, undefined, 5)` voor de laatste gesprekken en
`useRecentRuns(profile?.id, 5)` voor de laatste analyses. Chat-assistenten zijn
`is_active && type === 'chat'`. Het `Select`-veld toont een placeholder "Kies een
assistent"; bij precies één actieve chat-assistent wordt die automatisch gekozen, bij
meerdere moet de adviseur kiezen. Versturen kan alleen bij een niet-lege (getrimde) vraag
én een gekozen assistent. De risico-analyseknop verschijnt alleen als er minstens één
actieve `risico_analyse`-assistent is: bij precies één navigeert de knop direct naar
`/analyse/new/:assistantId`; bij meerdere naar `/assistants`, waar de adviseur de juiste
assistent kiest.

**Rationale**: hergebruik van bestaande hooks en servercontracten houdt de wijziging
klein. De auto-select bij één assistent voorkomt een onnodige klik; bij meerdere is een
expliciete keuze veiliger dan stil de eerste assistent pakken. De knop naar `/assistants`
bij meerdere risico-assistenten hergebruikt de bestaande kaartactie "Risico-analyse
starten" en voorkomt een verkeerde start.

**Alternatives considered**:
- Altijd de eerste assistent voorsselecteren — afgewezen: bij meerdere assistenten kan de
  adviseur per ongeluk de verkeerde gebruiken.
- Een aparte keuzepagina voor risico-assistenten — afgewezen: `AssistantsPage` heeft die
  keuze al; een nieuwe pagina is scope-uitbreiding.
- Nieuwe query's/endpoints — afgewezen: de bestaande hooks dekken de behoefte.

## 3. Startvraag naar ChatPage — router-state, direct wissen, nooit opslag

**Decision**: `StartPage` navigeert bij versturen naar
`/chat/new/${assistantId}` met `{ state: { initialQuestion: trimmed } }`. `ChatPage` leest
`location.state.initialQuestion`, kopieert de tekst naar een `useRef`, zet een
`consumed`-ref en wist de router-state **direct** met
`navigate(location.pathname, { replace: true, state: null })` — vóór het wachten op de
assistent-query. Zodra `viewAssistant` beschikbaar is, verstuurt een tweede effect de vraag
eenmalig via de bestaande `sendMessage`. De `consumed`-ref voorkomt dubbele verzending bij
re-renders.

**Rationale**: de vraag mag nooit in het adres of in localStorage/sessionStorage belanden.
React Router bewaart state in het tab-gebonden History API-state, niet in de URL en niet in
webopslag; door de state meteen met `replace` te wissen, blijft er geen vraag achter in de
history-entry. De tekst leeft daarna alleen in het geheugen van de component. PostHog heeft
`autocapture: false` en `disable_session_recording: true` (geverifieerd in
`src/lib/posthog.tsx`), dus de invoer wordt niet als event of replay verzonden. Er komt
geen `console.log` bij.

**Alternatives considered**:
- Vraag als queryparameter (`?q=`) — afgewezen: expliciet verboden door constitution III
  en de acceptatiecriteria.
- Vraag in sessionStorage/localStorage — afgewezen: verboden door constitution III.
- `window.history.state` handmatig vullen — afgewezen: de router doet dit al; handmatig
  ingrijpen is foutgevoeliger.
- De vraag op de chatpagina als concept invullen en de gebruiker opnieuw laten versturen —
  afgewezen: de spec zegt "versturen opent een nieuw gesprek met die vraag"; de route
  schrijft een eenmalige verzending voor.

## 4. `useRecentRuns` — limietparameter met limiet in de queryKey

**Decision**: breid `useRecentRuns(advisorId, limit = 10)` uit met een optionele
`limit`-parameter en zet de limiet in de queryKey:
`['analysis-recent-runs', advisorId, limit]`. De bestaande `refetchInterval`-logica
(alleen pollen bij queued/running) blijft ongewijzigd. Start gebruikt `limit = 5`,
Geschiedenis `limit = 50`; de bestaande consumenten (`useAnalysisNotifications`,
`RecentRunsPanel`, `AnalysisNewPage`) houden de default 10 en delen daardoor nog steeds
dezelfde cache-entry.

**Rationale**: zonder de limiet in de queryKey zouden Start (5) en Geschiedenis (50)
dezelfde cache-entry gebruiken en elkaars data overschrijven. De default 10 houdt het
bestaande gedrag en de gedeelde query van feature 014 intact. `fetchRecentRuns` accepteert
de limiet al en de mock-server leest `limit` uit de query en past `slice(0, limit)` toe
(gecontroleerd in `scripts/mock-analysis-server.mjs`); 50 werkt zonder codewijziging.

**Alternatives considered**:
- Aparte queryKey zonder limiet — afgewezen: cache-collisie tussen 5 en 50.
- Voor Geschiedenis de 50 items uit de 10-itemcache halen — afgewezen: dan ontbreken
  items; de spec vraagt een lijst tot 50.

## 5. Contract 008 — `limit` tot 50 vastgelegd

**Decision**: voeg in `specs/008-risico-analyse-ui/contracts/run-status.md` onder
"Recente runs per adviseur" een gedateerde notitie toe dat het endpoint `limit` tot en met
50 moet accepteren en honoreren (standaard blijft 10), met de verwijzing naar deze feature.
De mock-server is gecontroleerd en hoeft niet te wijzigen.

**Rationale**: de Geschiedenis-pagina is de eerste consument die meer dan 10 items vraagt.
Het contract was expliciet op 10 gesteld; zonder notitie zou de backend de 50 stil kunnen
negeren. De notitie is additief en breekt bestaande consumenten niet.

**Alternatives considered**:
- Client-side pagineren met meerdere 10-requests — afgewezen: meer verzoeken, meer
  complexiteit, en de spec/route vraagt één lijst met limit 50.
- Contract ongewijzigd laten — afgewezen: dan is de 50-request niet afgedwongen.

## 6. `useConversations` — nieuwste activiteit bovenaan

**Decision**: wijzig de order in `useConversations` van `created_at desc` naar
`updated_at desc`. De hook wordt alleen gebruikt door `HistoryPage` (nu) en `StartPage`
(nieuw); de queryKey blijft gelijk (inclusief `limit`). Start vraagt limit 5, Geschiedenis
limit 200.

**Rationale**: de spec vraagt "de vijf laatste gesprekken" en de rij toont "datum laatst
bijgewerkt"; sorteren op `created_at` zou een recent bijgewerkt oud gesprek ten onrechte
onderaan zetten. De hook heeft geen andere consumenten, dus de wijziging is lokaal en
gericht.

**Alternatives considered**:
- Op `created_at` blijven sorteren en `updated_at` alleen tonen — afgewezen: dan klopt de
  volgorde niet met wat de adviseur als "recent" ervaart.

## 7. HistoryPage — twee tabs, Links, bestaande assistent-filter behouden

**Decision**: herschrijf `HistoryPage` met het bestaande `Tabs`-component:
`Gesprekken` en `Risico-analyses`. Gesprekken:
`useConversations(profile?.id, filterAssistantId, 200)`; de bestaande assistent-filter
(`Select` + `useAssistantOptions`) blijft behouden, maar verhuist naar het tabblad
Gesprekken. Elke rij is een `<Link to={'/chat/' + id}>` met icoon, titel, assistentnaam en
`updated_at`. Analyses: `useRecentRuns(profile?.id, 50)`; elke rij is een
`<Link to={'/analyse/' + id}>` met klantreferentie, statusbadge (wachtrij/bezig/klaar/
mislukt), startdatum en bij `succeeded` + `expires_at` "beschikbaar tot dd-mm-jjjj".
`ConversationDrawer` en de `Nieuw`/`Afgerond`-badge verdwijnen.

**Rationale**: de spec eist dat een gesprek opent op de gesprekspagina waar verder chatten
mogelijk is; de drawer was alleen-lezen. Links zijn native toetsenbordbedienbaar (Tab +
Enter) en geven een zichtbare focusstate. De bestaande assistent-filter is geen onderdeel
van de klacht en de route noemt hem niet bij de te verwijderen onderdelen; hem laten staan
is de meest chirurgische keuze ("geen refactors ernaast"). De filter werkt server-side op
assistent-id (geen klantinhoud in de URL) en blijft binnen de bestaande 200-limiet.

**Alternatives considered**:
- Drawer behouden en een "verder chatten"-knop toevoegen — afgewezen: de spec wil openen
  op het gesprek zelf; een extra stap is onnodig.
- De assistent-filter verwijderen — afgewezen: niet gevraagd, verwijdert bestaande
  functionaliteit en maakt `useAssistantOptions` onnodig dood.
- Kaarten met `onClick` behouden — afgewezen: niet toetsenbordbereikbaar (kernklacht).

## 8. Zoeken — client-side, per tab, hoofdletter- en diakrietongevoelig

**Decision**: elk tabblad heeft een eigen zoekterm in React-state. Filteren gebeurt met
`useMemo` over de al geladen lijst: Gesprekken op `title`, Risico-analyses op
`client_reference`. Normalisatie: `toLocaleLowerCase('nl-NL')` +
`.normalize('NFD').replace(/\p{Diacritic}/gu, '')` (target ES2020 ondersteunt
Unicode-property-escapes). De zoekterm komt niet in de URL, niet in een request en niet in
opslag. Een lege uitkomst toont "Geen resultaten" met een knop "Zoekterm wissen"; wissen
herstelt de volledige lijst.

**Rationale**: de acceptatiecriteria eisen browserfiltering op de geladen lijst en geen
zoekterm in request-URL's. Aparte state per tab voorkomt dat een term ongemerkt op de
andere lijst wordt toegepast (spec edge case). Normalisatie maakt zoeken praktisch bruikbaar
zonder serverzoekopdracht.

**Alternatives considered**:
- Server-side zoeken (Supabase `ilike`) — afgewezen: verboden door de spec (zoekterm in
  request-URL) en onnodig voor de geladen limieten.
- Eén gedeelde zoekterm voor beide tabs — afgewezen: de spec wil per tabblad filteren.

## 9. Lege, laad- en fouttoestanden

**Decision**: gebruik bestaande `Skeleton`/`EmptyState`/`Button`-componenten. Per blok:
- Start, geen gesprekken: "Nog geen gesprekken" + actie "Stel uw eerste vraag" (focus op
  het vraagveld).
- Start, geen analyses: als er een risico-assistent is "Nog geen risico-analyses" + actie
  "Start een risico-analyse"; anders uitleg + link "Naar assistenten".
- Geschiedenis, leeg tabblad: korte uitleg + actie ("Start een gesprek" → `/start`,
  "Naar assistenten" → `/assistants`).
- Zoeken zonder resultaat: "Geen resultaten" + "Zoekterm wissen".
- Queryfout: `role="alert"` met Nederlandse melding + "Opnieuw proberen" (`refetch`).

**Rationale**: FR-007, FR-014 en FR-021 eisen uitleg + actie en zichtbare fouten
(constitution V). Hergebruik van bestaande componenten houdt de UI consistent.

**Alternatives considered**:
- Alleen een tekstregel zonder actie — afgewezen: acceptatiecriterium eist een actie.
- Fouten als lege lijst tonen — afgewezen: stille fout (constitution V).

## 10. Toegankelijkheid — Links, labels, focus, tekstbadges

**Decision**: alle rijen en kaarten zijn `<Link>`-elementen met
`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring` (of de
bestaande focusstijl). Het vraagveld krijgt `<Label htmlFor="start-question">Uw vraag</Label>`;
de assistentkeuze wordt in een `<label>` gewikkeld (het bestaande `Select`-component heeft
geen `id`-prop, dus een wrapping label is de kleinste wijziging). Het zoekveld krijgt een
echt label. Statusbadges bevatten tekst ("in wachtrij", "bezig", "klaar", "mislukt"), geen
kleur-only signaal. Tabbladen gebruiken het bestaande `Tabs`-component (SettingsPage
gebruikt het al); er wordt niet aan dat component gesleuteld.

**Rationale**: constitution IV en FR-016/FR-017. Native links en labels geven
toetsenbordbediening en schermlezerkoppeling zonder extra JavaScript. Het niet aanpassen
van `Tabs` respecteert "geen refactors" en de bestaande consument (SettingsPage).

**Alternatives considered**:
- `div` met `role="link"`/`tabIndex` — afgewezen: native `<Link>` is eenvoudiger en
  betrouwbaarder.
- `Tabs` herschrijven met pijltjestoetsen — afgewezen: buiten scope en raakt een bestaande
  pagina; Tab + Enter werkt.

## 11. Verwijderen van Command Center en de bijbehorende hook

**Decision**: verwijder `src/pages/CommandCenterPage.tsx`, de lazy import/route in
`App.tsx`, en `useDashboardCounts` + `DashboardCounts` uit `queries.ts`. `Gauge`-import in
`AppShell` verdwijnt. `useAssistantOptions` blijft, omdat de bestaande assistent-filter op
het tabblad Gesprekken blijft staan.

**Rationale**: de opdracht noemt expliciet het verwijderen van CommandCenterPage en
`useDashboardCounts` "als ze niet meer gebruikt worden"; dat geldt na de routewissel. De
assistent-filter is niet gevraagd te verwijderen, dus de hook blijft in gebruik en er
ontstaat geen dode code.

**Alternatives considered**:
- Command Center als verborgen route laten bestaan — afgewezen: de opdracht wil een
  doorverwijzing, geen dubbele pagina.
- De assistent-filter en `useAssistantOptions` toch verwijderen — afgewezen: niet
  gevraagd, verwijdert bestaande functionaliteit en is geen chirurgische wijziging.

## 12. Tests — nieuwe specs, fixture-aanpassing, route-mocks

**Decision**:
- `tests/e2e/start-page.spec.ts`:
  1. mock `ai_assistants` (één actieve chat-assistent), `conversations`, `analysis-runs`
     en `rag-chat`; ga naar `/start`, vul "Uw vraag", verstuur; verwacht het antwoord en
     `/chat/<uuid>`; assert dat `page.url()` de vraag niet bevat en dat
     `localStorage`, `sessionStorage` én `history.state` de vraag niet bevatten.
  2. `page.goto('/command-center')` → verwacht `/start`.
- `tests/e2e/history-page.spec.ts`: mock twee gesprekken (verschillende titels) en twee
  analyses (verschillende klantreferenties). Test: beide tabs zichtbaar; zoeken op titel
  filtert; zoeken op klantreferentie filtert; geen resultaat toont "Zoekterm wissen";
  `focus()` op een gesprekslink + `Enter` navigeert naar `/chat/:id`; analyse-rij toont
  status en "beschikbaar tot". Monitor tijdens het typen dat geen request-URL de zoekterm
  bevat.
- `tests/e2e/fixtures.ts`: login-assertie wordt `/start|assistants/` (de redirect is nu
  `/start`), anders falen alle bestaande ingelogde tests.
- Bestaande tests blijven ongewijzigd voor zover ze expliciet naar `/assistants` of
  `/analyse/...` navigeren; alleen de login-fixture raakt de nieuwe landingspagina.

**Rationale**: de opdracht noemt precies deze gevallen. Route-mocks houden de tests
deterministisch en vermijden echte data (constitution III). De fixture-aanpassing is
verplicht: `login()` controleert nu op `assistants|command-center`, en `/command-center`
redirect naar `/start`, dus zonder aanpassing faalt elke test met login.

**Gevolg voor bestaande specs**: na login landen alle tests nu op `/start`, dat meteen
`ai_assistants`, `conversations` (limit 5) en `analysis-runs` (limit 5) opvraagt. Tests die
die routes al mocken (chat-, admin- en analysetests) blijven werken; de overige requests
zijn read-only met de e2e-gebruiker. `analysis-jwt.spec.ts` ziet de recent-runs-request nu
mogelijk al vanaf het startscherm — dezelfde getypeerde client met hetzelfde JWT, dus de
assertie blijft geldig. Er is geen bestaande test die het aantal requests op de
landingspagina telt.

**Alternatives considered**:
- Echte data/seed voor Geschiedenis — afgewezen: traag, niet deterministisch en schrijft
  mogelijk klantdata.
- Alleen een unit-test voor filteren — afgewezen: de acceptatiecriteria vragen
  toetsenbordnavigatie en URL/opslagbewijs in de browser.

## 13. Geen wijzigingen aan chat- of analysepagina's (grensbewaking)

**Decision**: `ChatPage` krijgt uitsluitend de eenmalige `initialQuestion`-overname
(beschreven in #3). `AnalysisNewPage`, `AnalysisRunPage`, `analysis-client`,
`analysis-schemas` en de analysecomponenten blijven ongewijzigd. De statuslabels in
Geschiedenis zijn een lokale weergavefunctie; `RecentRunsPanel` wordt niet aangepast.

**Rationale**: de opdracht sluit wijzigingen aan chat- en analysepagina's uit, met als
enige noodzakelijke uitzondering het doorgeven van de startvraag. Zo blijft de bestaande
analyse- en chatdekking intact.

**Alternatives considered**:
- Een gedeelde statuslabel-helper extraheren — afgewezen: raakt `RecentRunsPanel` zonder
  functionele noodzaak; een kleine lokale functie volstaat.
