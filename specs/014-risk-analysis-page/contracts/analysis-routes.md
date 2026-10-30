# Contract: analysepagina's, recente-lijst en meldingen (UI)

**Feature**: 014-risk-analysis-page | **Date**: 2026-10-30 | **Implementatie**:
`src/pages/AnalysisNewPage.tsx`, `src/pages/AnalysisRunPage.tsx`,
`src/hooks/useAnalysisNotifications.ts`, `src/store/analysisSeenStore.ts`,
`src/lib/analysis-retry.ts`, `src/components/layout/AppShell.tsx`

**Servercontract nagenoeg ongewijzigd**: de bestaande endpoints uit
`specs/008-risico-analyse-ui/contracts/run-status.md` blijven bestaan
(submit, run-status-polling, recente-lijst, JWT op elke call). De enige wijziging is
**toevoegend** en wordt in dat 008-bestand zelf genoteerd (§3).

## 1. Routes (id-only, constitution III)

| Route | Params | Router-state | Weergave |
|-------|--------|--------------|----------|
| `GET /analyse/new/:assistantId` | `assistantId: uuid` | optioneel `{ retryRunId: uuid }` (memory-only, nooit in de URL) | kop (assistent + adviseurnaam als vaste tekst + CONCEPT-label), `AnalysisForm`, bijlagen-melding (retry mét `hadBestanden`), `RecentRunsPanel` |
| `GET /analyse/:runId` | `runId: uuid` | — | `RunCard` + bij `succeeded` `ResultView` (ongewijzigd, incl. CONCEPT-labels); `failed` + snapshot → "Opnieuw" navigeert naar `/analyse/new/:assistantId` met `{ retryRunId }` |

- Beide routes liggen binnen de `AppShell`-layout (zijbalk zichtbaar).
- Onbekende run/assistent of geen toegang → nette Nederlandse melding ("Analyse niet
  gevonden" / "Assistent niet gevonden") met teruglink; nooit inhoud van anderen.
- De kaartknop "Risico-analyse starten" op `/assistants` navigeert naar
  `/analyse/new/:assistantId` (geen zijpaneel meer).

## 2. Recente-lijst — contractwijziging `expires_at`

`GET /analysis-runs?advisor_id=…&limit=10` (bestaand, JWT, RLS) krijgt per item één
extra veld:

```json
{ "id": "uuid", "assistant_id": "uuid", "client_reference": "…",
  "status": "queued|running|succeeded|failed",
  "started_at": "…", "finished_at": "…|null", "error_code": "…|null",
  "expires_at": "2026-11-06T10:02:30Z" }
```

- Frontendschema (`RecentRunSchema`): `expires_at` is **optioneel** (`string (datetime)
  | null | undefined`) — rollout-veilig: als de backend het veld nog niet levert,
  blijven items geldig en toont de lijst alles behalve de vervaldatum (research #7).
- Mock-server (`scripts/mock-analysis-server.mjs`, `publicRecent`): levert het veld
  altijd (bestaande run-recordwaarde).
- Display: "beschikbaar tot dd-mm-jjjj" uitsluitend bij `status === 'succeeded'`
  én aanwezig `expires_at`; overige statussen tonen geen vervaldatum (FR-011).
- Notitie van deze wijziging wordt toegevoegd in
  `specs/008-risico-analyse-ui/contracts/run-status.md` §"Recente runs per adviseur"
  (datum + feature-verwijzing). Geen andere backendvelden wijzigen.

## 3. Meldingen (zijbalk + tabbladtitel) — UI-semantiek

- Query: bestaande `['analysis-recent-runs', advisorId]` (gedeeld met de lijst);
  `refetchInterval` = 10 s zolang de geladen lijst een `queued`/`running`-run bevat,
  anders geen interval (acceptatiecriterium polling).
- Gezien-registratie: `sessionStorage` met uitsluitend run-id's (max 50) +
  initialisatievlag; `markSeen` door `AnalysisNewPage` (alle afgeronde lijstitems)
  en `AnalysisRunPage` (de run zodra afgerond).
- Badge: cijfertext bij het zijbalkmenu-item "Assistenten" (desktop + mobiel),
  toegankelijke naam "n analyses klaar of mislukt sinds uw laatste bezoek",
  alleen bij n > 0; tekst, geen kleur-only signaal (WCAG).
- `document.title`: `(n) Darwin` bij n > 0; anders de basis-titel
  ("Darwin - AI Platform", gemeten bij mount). Bevat nooit een klantreferentie of
  andere klantinhoud (constitution III).

## 4. Retry-snapshot (in-memory)

Module-level Map (geen browseropslag): `runId → { values: AnalysisFormValues
(bestanden: []), hadBestanden: boolean }`. Geschreven bij een geslaagde submit op
`AnalysisNewPage`; gelezen bij "Opnieuw" op `AnalysisRunPage`. Bestaat de sleutel
niet (bijv. na verversen): geen "Opnieuw" en de bestaande melding "De eerdere
invoer is niet meer beschikbaar in deze sessie". Bestanden worden nooit bewaard —
de bijlagen-melding verwijst naar `hadBestanden`.