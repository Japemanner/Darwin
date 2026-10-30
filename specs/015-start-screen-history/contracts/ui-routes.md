# Contract: UI-routes, vraag-overdracht en zoekgedrag

**Feature**: 015-start-screen-history | **Datum**: 2026-10-30 | **Implementatie**:
`src/App.tsx`, `src/pages/StartPage.tsx`, `src/pages/HistoryPage.tsx`,
`src/pages/ChatPage.tsx`, `src/hooks/queries.ts`, `src/hooks/useRecentRuns.ts`

Dit contract beschrijft uitsluitend de UI-afspraken die voor deze feature relevant zijn.
Bestaande servercontracten (Supabase REST, rag-chat, analyse-API) blijven ongewijzigd,
met één additieve notitie voor `limit` in
`specs/008-risico-analyse-ui/contracts/run-status.md`.

## 1. Routes

| Route | Weergave | Toegang |
|-------|----------|---------|
| `/start` | Startscherm: vraagveld, assistentkeuze, 5 gesprekken, 5 analyses, risico-knop | Ingelogd (ProtectedRoute + AppShell) |
| `/command-center` | Doorverwijzing naar `/start` (`replace`) | Openbaar bereikbaar; redirect |
| `*` | Doorverwijzing naar `/start` (`replace`) | Openbaar bereikbaar; redirect |
| `/chat/new/:assistantId` | Bestaande chatpagina; optioneel `initialQuestion` via router-state | Ingelogd |
| `/chat/:conversationId` | Bestaande gesprekspagina (hervatbaar) | Ingelogd |
| `/analyse/new/:assistantId` | Bestaande analyse-startpagina | Ingelogd |
| `/analyse/:runId` | Bestaande analyse-statuspagina | Ingelogd |

**Redirect na inloggen**: `LoginPage` gebruikt
`localStorage.getItem('redirectAfterLogin') || '/start'`. `ProtectedRoute` bewaart
uitsluitend het pad (geen inhoud) in `redirectAfterLogin`, zoals nu.

## 2. Vraag-overdracht Start → Chat

```text
StartPage
  onSubmit:
    trim(question) niet leeg én assistantId gekozen
    navigate(`/chat/new/${assistantId}`, { state: { initialQuestion: question.trim() } })

ChatPage (alleen bij /chat/new/:assistantId)
  leest location.state.initialQuestion (alleen string)
  kopieert naar een ref en zet consumed = true
  navigate(location.pathname, { replace: true, state: null })   // direct wissen
  zodra de assistent geladen is: sendMessage(initialQuestion) eenmalig
```

Regels:

- De vraag komt **niet** in de URL, `localStorage`, `sessionStorage`, cookies, logs of
  PostHog. React Router-state is tab-gebonden geheugen en wordt direct met `replace`
  gewist; de e2e-test controleert ook `history.state`.
- De vraag wordt niet opnieuw verzonden bij re-renders, herladen of browserterug: de
  history-entry is vervangen en de ref is verbruikt.
- Bij een ongeldige/niet-beschikbare assistent toont `ChatPage` de bestaande
  "Assistent niet gevonden"-melding; de vraag wordt niet alsnog ergens opgeslagen.
- Een mislukte verzending gebruikt de bestaande chatfout + "Opnieuw proberen"; de
  startvraag is dan al uit de router-state verdwenen.

## 3. Startscherm-data

| Blok | Bron | Limiet | Weergave |
|------|------|--------|----------|
| Assistenten | `useAssistants(organization_id)` gefilterd op `is_active && type === 'chat'` | — | `Select` met naam/icoon; placeholder bij 0 of >1 keuze |
| Recente gesprekken | `useConversations(user_id, undefined, 5)` | 5 | `<Link to="/chat/:id">` met titel, assistent, `updated_at` |
| Recente analyses | `useRecentRuns(user_id, 5)` | 5 | `<Link to="/analyse/:id">` met klantreferentie, statusbadge, `started_at` |
| Risico-knop | `useAssistants` gefilterd op `is_active && type === 'risico_analyse'` | — | Alleen bij ≥1; bij 1 → `/analyse/new/:id`, bij >1 → `/assistants` |

Selectie: bij precies één actieve chat-assistent is die vooraf gekozen; bij meerdere
blijft de keuze leeg tot de adviseur kiest. Versturen is uitgeschakeld zonder geldige
vraag én assistent.

## 4. Geschiedenis

Tabs: `Gesprekken` (standaard) en `Risico-analyses` (bestaand `Tabs`-component).

| Tab | Bron | Limiet | Rij |
|-----|------|--------|-----|
| Gesprekken | `useConversations(user_id, filterAssistantId, 200)` | 200 | `<Link to="/chat/:id">`: icoon, titel, assistentnaam, `updated_at`; bestaande assistent-filter in dit tabblad |
| Risico-analyses | `useRecentRuns(user_id, 50)` | 50 | `<Link to="/analyse/:id">`: klantreferentie, statusbadge, `started_at`, bij `succeeded` + `expires_at` "beschikbaar tot dd-mm-jjjj" |

Verwijderd: `ConversationDrawer` en de `Nieuw`/`Afgerond`-badge. De bestaande
assistent-filter (`Select` + `useAssistantOptions`) blijft behouden op het tabblad
Gesprekken; de assistentnaam blijft daarnaast als tekst in de gespreksrij staan.

## 5. Zoeken

- Per tab een eigen zoekterm in React-state.
- Filteren gebeurt op de **al geladen** lijst: Gesprekken op `title`, Analyses op
  `client_reference`.
- Hoofdletterongevoelig en diakrietongevoelig.
- Geen zoekterm in een request-URL, het adres, `localStorage`/`sessionStorage` of
  analytics.
- Lege uitkomst: korte uitleg + knop "Zoekterm wissen"; wissen toont de volledige lijst.
- Wisselen van tab past de zoekterm niet toe op het andere tabblad.

## 6. `limit` op de recente-runs-lijst

- `GET {VITE_ANALYSIS_API_URL}/analysis-runs?advisor_id=…&limit=…` (bestaand, JWT).
- Start: `limit=5`. Geschiedenis: `limit=50`. Bestaande consumenten: `limit=10`.
- Het endpoint MOET `limit` tot en met 50 honoreren; de standaard blijft 10.
- `useRecentRuns(advisorId, limit = 10)` neemt de limiet op in de queryKey, zodat
  verschillende limieten niet dezelfde cache-entry delen.
- De mock-server leest `limit` en past `slice(0, limit)` toe; 50 is gecontroleerd en
  vereist geen codewijziging.

## 7. Fouten en lege toestanden

| Situatie | UI |
|----------|----|
| Geen actieve chat-assistenten | Uitleg + actie "Naar assistenten" (of equivalente route); vraagveld niet bruikbaar |
| Geen gesprekken (Start) | "Nog geen gesprekken" + actie "Stel uw eerste vraag" (focus vraagveld) |
| Geen analyses (Start) | "Nog geen risico-analyses" + "Start een risico-analyse" of "Naar assistenten" |
| Leeg tabblad (Geschiedenis) | Uitleg + actie "Start een gesprek" (`/start`) of "Naar assistenten" |
| Geen zoekresultaat | "Geen resultaten" + "Zoekterm wissen" |
| Queryfout | `role="alert"` met Nederlandse melding + "Opnieuw proberen" (`refetch`) |

## 8. Toegankelijkheid

- Rijen/kaarten zijn `<Link>`-elementen: Tab bereikt ze, Enter opent ze, en er is een
  zichtbare `focus-visible`-ring.
- Vraagveld, assistentkeuze en zoekveld hebben een programmatisch gekoppeld label.
- Statusbadges bevatten tekst; kleur is nooit het enige signaal.
- Tabbladen gebruiken het bestaande `Tabs`-component (role=tab, aria-selected); er worden
  geen wijzigingen aan dat gedeelde component gedaan.
