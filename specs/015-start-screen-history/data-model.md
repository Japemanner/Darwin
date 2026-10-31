# Data Model: Startscherm rond de vraag en één overzicht van eerder werk

**Date**: 2026-10-30 | **Feature**: [spec.md](spec.md) | **Branch**: `015-start-screen-history`

**Geen database-migraties, geen Edge Function-wijzigingen, geen nieuwe dependencies.**
De feature werkt volledig met bestaande Supabase-data en het bestaande analyse-API-contract.
De enige contractwijziging is additief: de recente-runs-lijst moet `limit` tot 50
ondersteunen (notitie in `specs/008-risico-analyse-ui/contracts/run-status.md`).

## Routes

| Route | Bron | Gedrag |
|-------|------|--------|
| `/start` | `src/pages/StartPage.tsx` (nieuw) | Vraagveld + actieve chat-assistenten; 5 laatste gesprekken; 5 laatste analyses; knop "Nieuwe risico-analyse" als er een risico-analyse-assistent is. |
| `/command-center` | `App.tsx` | `<Navigate to="/start" replace />` — oude links en bladwijzers blijven werken. |
| `*` | `App.tsx` | `<Navigate to="/start" replace />` — onbekende paden landen op het startscherm. |
| `/chat/new/:assistantId` | bestaand | Ontvangt optioneel router-state `{ initialQuestion }`; `ChatPage` neemt de vraag eenmalig over en wist de state direct met `replace`. |
| `/chat/:conversationId` | bestaand | Doel van een gespreksrij in Geschiedenis; gesprek is daar hervatbaar. |
| `/analyse/new/:assistantId` | bestaand | Doel van de knop "Nieuwe risico-analyse" (bij één risico-assistent) en van de kaartactie op Assistenten. |
| `/analyse/:runId` | bestaand | Doel van een analyse-rij in Geschiedenis en op het startscherm. |

Adressen bevatten uitsluitend id's (assistent-id, conversation-id, run-id). De startvraag
en de zoekterm komen nooit in een route of queryparameter (constitution III).

## UI-state

### Startvraag

| Veld | Type | Regels |
|------|------|--------|
| `question` | `string` (React-state) | Getrimd; leeg/alleen whitespace blokkeert versturen. Bestaat alleen zolang `StartPage` gemount is. |
| `initialQuestion` | `string` (React Router-state, memory-only) | Wordt bij versturen meegegeven aan `/chat/new/:assistantId`; `ChatPage` kopieert de waarde naar een ref en wist de state direct met `replace`. Nooit in URL, localStorage, sessionStorage, cookies, logs of PostHog. |
| `assistantId` | `string` (React-state) | Id van de gekozen actieve chat-assistent; leeg tot de adviseur kiest (of automatisch gezet bij precies één actieve chat-assistent). |

### Startscherm-selecties

| Veld | Type | Regels |
|------|------|--------|
| `chatAssistants` | afgeleid van `useAssistants` | `is_active === true && type === 'chat'`; opties met id, naam en icoon. |
| `recentConversations` | `useConversations(userId, undefined, 5)` | Gesorteerd op `updated_at desc`; titel, assistentnaam, `updated_at`. |
| `recentRuns` | `useRecentRuns(userId, 5)` | Gesorteerd op `started_at desc`; klantreferentie, status, `started_at`. |
| `riskAssistant` | afgeleid van `useAssistants` | Eerste actieve `risico_analyse`-assistent; bepaalt of de knop zichtbaar is. Bij meerdere navigeert de knop naar `/assistants` in plaats van direct naar een specifieke assistent. |

### Geschiedenis

| Veld | Type | Regels |
|------|------|--------|
| `activeTab` | `'conversations' \| 'analyses'` | Standaard `conversations`. |
| `filterAssistantId` | `string` (React-state, bestaand) | Bestaande assistent-filter op het tabblad Gesprekken; standaard `'all'`; uitsluitend een assistent-id in de bestaande query, geen klantinhoud. |
| `conversationQuery` | `string` (React-state) | Filtert uitsluitend het tabblad Gesprekken op `title`; nooit in een request of URL. |
| `analysisQuery` | `string` (React-state) | Filtert uitsluitend het tabblad Risico-analyses op `client_reference`; nooit in een request of URL. |
| `conversations` | `useConversations(userId, filterAssistantId, 200)` | Rij: icoon, titel, assistentnaam, `updated_at`; `<Link to="/chat/:id">`. |
| `recentRuns` | `useRecentRuns(userId, 50)` | Rij: klantreferentie, statusbadge, `started_at`, bij `succeeded` + `expires_at` "beschikbaar tot dd-mm-jjjj"; `<Link to="/analyse/:id">`. |

Normalisatie voor zoeken: `toLocaleLowerCase('nl-NL')` en diakrieten strippen met
`.normalize('NFD').replace(/\p{Diacritic}/gu, '')`. Dit gebeurt op de al geladen array;
er volgt geen nieuw verzoek.

## Entiteiten (bestaand, ongewijzigd)

### Chat-assistent

Id, organisatie-id, naam, icoon, type (`chat` | `agent` | `voice` | `risico_analyse`),
`is_active`, voorbeeldvragen. Alleen actieve `chat`-assistenten zijn kiesbaar op het
startscherm.

### Gesprek

Id, gebruiker-id, assistent-id, titel, `created_at`, `updated_at`, ingebedde
assistentgegevens (naam/icoon). De Geschiedenis-rij toont titel, assistent en
`updated_at`; openen navigeert naar de bestaande gesprekspagina.

### Risico-analyse (run, lijstitem)

Id, assistent-id, klantreferentie, status (`queued` | `running` | `succeeded` | `failed`),
`started_at`, `finished_at`, `error_code`, `expires_at`. Lijstitems bevatten uitsluitend
metadata — geen analyse-inhoud, bestandsnamen of URL's (008-contract). De rijen tonen
klantreferentie, status en datums; de URL bevat alleen het run-id.

### Zoekterm

Tijdelijke UI-state, per tabblad. Geen entiteit in de database en geen veld in een
verzoek. Wordt niet bewaard bij het verlaten of herladen van de pagina.

## Statuslabels en datumweergave

| Runstatus | Label in de UI |
|-----------|----------------|
| `queued` | in wachtrij |
| `running` | bezig |
| `succeeded` | klaar |
| `failed` | mislukt |

- Datums in Geschiedenis: `dd-mm-jjjj` (startdatum analyse, datum laatst bijgewerkt
  gesprek). "Beschikbaar tot" verschijnt uitsluitend bij `succeeded` én een aanwezige
  `expires_at`.
- Status is tekst in een badge; kleur is aanvullend, nooit het enige signaal (WCAG AA).

## Validatieregels

- Versturen op het startscherm: `question.trim().length > 0` én een gekozen actieve
  chat-assistent; anders is de knop uitgeschakeld.
- Alleen actieve chat-assistenten verschijnen in de keuze; risico-analyse-assistenten
  verschijnen daar niet.
- "Nieuwe risico-analyse" is afwezig zonder actieve risico-analyse-assistent.
- Zoeken: lege term toont de volledige geladen lijst; een term zonder match toont de
  lege zoektoestand met "Zoekterm wissen".
- Fout bij het laden: zichtbare melding + "Opnieuw proberen"; nooit een stille lege lijst.

## Toestandsovergangen

```text
StartPage
  ├─ vraag leeg / geen assistent → versturen uitgeschakeld
  ├─ versturen → navigate('/chat/new/:assistantId', { state: { initialQuestion } })
  │     └─ ChatPage: state → ref, state gewist (replace), vraag verzonden
  │           ├─ succes → bestaand gesprek op /chat/:conversationId
  │           └─ fout → bestaande foutmelding + "Opnieuw proberen" op de chatpagina
  ├─ gesprek klikken → /chat/:conversationId
  ├─ analyse klikken → /analyse/:runId
  └─ "Nieuwe risico-analyse" → /analyse/new/:assistantId (één) of /assistants (meerdere)

HistoryPage
  ├─ tab wisselen → actieve lijst + eigen zoekterm
  ├─ assistent-filter wisselen → bestaande query met assistent-id (tabblad Gesprekken)
  ├─ zoeken → in-memory filter (geen request)
  ├─ gesprek klikken/Enter → /chat/:conversationId
  └─ analyse klikken/Enter → /analyse/:runId
```
