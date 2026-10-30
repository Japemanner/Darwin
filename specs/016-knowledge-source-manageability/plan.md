# Implementation Plan: Kennisbronnenbeheer dat laat zien of een bron bruikbaar is

**Branch**: `016-knowledge-source-manageability` | **Date**: 2026-10-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/016-knowledge-source-manageability/spec.md`

## Summary

Maak kennisbronnen beoordeelbaar zonder ze te openen: kaartstatistieken (aantal documenten, aantal fouten, laatste wijziging) uit één geaggregeerde view, automatisch verversen van documentstatussen zolang er iets in verwerking is, herstelbare fouten met reden en "Opnieuw verwerken", bevestiging bij verwijderen, een vergrendelde naam zodra een bron documenten heeft, meervoudig uploaden met drag-and-drop en toetsenbordalternatief, en het verwijderen van het Vector Collection ID-veld en het Kennisitems-tabblad uit de UI.

De technische route is overgenomen, met één afwijking die voortkomt uit de bestaande RLS: `knowledge_base_documents` heeft geen UPDATE-policy (default deny, migratie 015). Daarom zet niet de client maar de bestaande `document-webhook`-serverroute (feature A) de status op `processing` en `error_message` op `null`, met de service role. De client doet één aanroep met `action: 'index'`.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict), React 18.3, Deno (Supabase Edge Function)

**Primary Dependencies**: Vite 6, TanStack React Query 5, `@supabase/supabase-js` 2, Tailwind CSS 3, bestaande `Dialog`-component, lucide-react, Playwright 1.64

**Storage**: Supabase PostgreSQL (RLS), Supabase Storage bucket `knowledge-documents`

**Testing**: Playwright E2E (`tests/e2e`, REST + edge function gemockt via `page.route`), `tsc --noEmit`, ESLint `--max-warnings 0`, `npm run build`

**Target Platform**: Web (Chromium), Netlify productie, Supabase Edge Functions

**Project Type**: Web application (single frontend + Supabase backend)

**Performance Goals**: Kaartstatistieken in één query per organisatie (geen N+1); documentstatus ververst elke 5 s uitsluitend zolang minstens één document `processing` is; verversen stopt direct daarna.

**Constraints**: Geen nieuwe npm-dependencies; UI-tekst Nederlands in u-vorm; code/identifiers/commits Engels; geen klantinhoud in URL's, console, logs, PostHog of browseropslag; beheeracties admin-only (feature B); bestaande kolommen en data blijven behouden.

**Scale/Scope**: Per organisatie tientallen kennisbronnen en honderden documenten; één kennisbron-detailpaneel tegelijk open.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status | Evidence |
|-----------|------|--------|----------|
| I. Dutch UI, English Code | UI-copy Nederlands (u-vorm), code/commits Engels | PASS | Nieuwe copy: "Opnieuw verwerken", "Weet u zeker dat u ... wilt verwijderen?", "Laatst bijgewerkt", "Bestanden toevoegen of sleep ze hierheen". |
| II. Concept, Never Advice | Geen gegenereerde output in deze feature | PASS | Geen AI-output; alleen beheer-UI. |
| III. Client Data Sensitivity | Geen klantinhoud in logs/URL's/analytics/storage | PASS | Edge-log blijft code + document-id + actie + duur. Geen documentnaam in URL of analytics. `error_message` wordt alleen in de eigen RLS-beveiligde rij opgeslagen en als tekst gerenderd. |
| IV. Accessibility WCAG 2.1 AA | Toetsenbordbediening, focus, semantiek | PASS | Upload via focusbare knop (native file input), drop-zone is aanvullend; bevestigingsdialog met Escape en autofocus op "Annuleren"; status per bestand in een lijst met `aria-live="polite"`. |
| V. Typed External Clients | Getypeerde clients, zichtbare fouten | PASS | `storage.ts` behoudt `DocumentWebhookError`; retry- en uploadfouten komen als Nederlandse toast; serverroute zet status terug op `error` bij upstream-falen. |
| VI. Minimal Scope | Alleen spec + gevraagde route | PASS | Alleen kennisbron-UI, één migratie, één edge-function-uitbreiding, types, tests, FEATURES.md. Geen refactors. |

**Post-design re-check**: PASS — dezelfde gates; de extra migratie is door de opdrachtgever gevraagd (`error_message`) en de status-update is naar de serverroute verplaatst om de bestaande RLS niet te verzwakken.

## Project Structure

### Documentation (this feature)

```text
specs/016-knowledge-source-manageability/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── document-retry.md
│   └── knowledge-base-stats.md
├── checklists/
│   └── requirements.md
└── spec.md
```

### Source Code (repository root)

```text
supabase/
├── migrations/
│   └── 018_knowledge_source_manageability.sql   # error_message + knowledge_base_stats view
└── functions/
    └── document-webhook/index.ts                # index: admin check, status processing/error

src/
├── types/database.types.ts                      # error_message + view type
├── hooks/queries.ts                             # stats-hook + 5s polling op documenten
├── lib/storage.ts                               # retryDocument() via bestaande webhook
└── pages/KnowledgePage.tsx                      # kaartstats, retry, bevestiging, rename-lock, multi-upload, UI-opschoning

tests/e2e/
└── knowledge-source-manageability.spec.ts       # bevestiging, rename-lock, multi-upload, polling-stop, retry

FEATURES.md                                      # notitie: Kennisitems-tab verborgen, data blijft
```

**Structure Decision**: Bestaande single-web-app-structuur. Geen nieuwe componenten of dependencies; de bevestigingsdialog wordt lokaal in `KnowledgePage.tsx` hergebruikt voor document en kennisitem, in dezelfde nested-Dialog-stijl als feature C (`AssistantsPage.tsx`).

## Implementation Notes

### 1. Migratie `018_knowledge_source_manageability.sql`

- `ALTER TABLE knowledge_base_documents ADD COLUMN IF NOT EXISTS error_message TEXT;`
- View `public.knowledge_base_stats` met `WITH (security_invoker = true)`:
  - `knowledge_base_id`, `organization_id`
  - `document_count` (`count(d.id)::int`)
  - `error_count` (`count(*) FILTER (WHERE d.status = 'error')::int`)
  - `last_updated_at` (`GREATEST(kb.updated_at, COALESCE(MAX(d.updated_at), kb.updated_at))`)
  - `FROM knowledge_bases kb LEFT JOIN knowledge_base_documents d ON d.knowledge_base_id = kb.id GROUP BY kb.id`
- `REVOKE ALL ON public.knowledge_base_stats FROM anon;`
- `REVOKE ALL ON public.knowledge_base_stats FROM authenticated;`
- `GRANT SELECT ON public.knowledge_base_stats TO authenticated;`
- Geen UPDATE-policy toevoegen; statusovergangen blijven bij de service role.

### 2. Types

- `knowledge_base_documents.Row/Insert/Update`: `error_message: string | null` (Insert optioneel).
- `Views.knowledge_base_stats` toevoegen conform de view.
- Type-alias `KnowledgeBaseStats`.

### 3. Datahaken (`src/hooks/queries.ts`)

- `useKnowledgeBaseStats(orgId)`: leest de view, filtert op `organization_id`, key `['kb-stats', orgId]`.
- `useKnowledgeBaseDocuments`: `refetchInterval` geeft `5000` zolang `data.some(d => d.status === 'processing')`, anders `false`; `refetchIntervalInBackground: false`.
- Invalidatie na upload, verwijderen en retry: `['kb-documents', kbId]` en `['kb-stats', orgId]`.

### 4. Retry (`src/lib/storage.ts` + `document-webhook`)

- `retryDocument(documentId)` roept uitsluitend `notifyDocumentWebhook(documentId, 'index')` aan; geen client-side UPDATE.
- Edge function, alleen bij `action === 'index'`:
  - leest `profiles.organization_id, role`; `role !== 'admin'` → `403 FORBIDDEN`;
  - zet vóór de n8n-call met de service role `status = 'processing'`, `error_message = null`;
  - bij upstream-fout (auth/error/timeout/unreachable) zet de service role `status = 'error'` en `error_message` op de bestaande Nederlandse fouttekst;
  - bij succes blijft `error_message` null. De n8n-flow vult later een eigen reden.
- Geen wijziging aan de n8n-ingestflow of payload.

### 5. Kaartstatistieken (`KnowledgePage.tsx`)

- Combineer `knowledgeBases` met `stats` op `knowledge_base_id`.
- Toon per kaart: aantal documenten, aantal fouten (destructief accent bij > 0), "Laatst bijgewerkt: &lt;datum&gt;" (nl-NL).
- Lege bron: "Nog geen documenten".
- Stats zijn read-only voor members; bewerkknop blijft admin-only.

### 6. Documentdetail

- Documentstatus: `processing` → "Verwerken...", `ready` → "Klaar", `error` → "Fout"; bij een gevulde `error_message` de reden eronder, anders de algemene tekst "De verwerking is mislukt. Probeer het opnieuw of neem contact op met de beheerder."
- "Opnieuw verwerken"-knop alleen voor admins bij `status === 'error'`; roept `retryDocument` aan, toont toast bij falen, invalideert docs + stats.
- Verwijderen: bevestigingsdialog met documentnaam; annuleren sluit zonder actie; bevestigen roept bestaande `deleteDocument` aan.
- Kennisitem-verwijdering behoudt dezelfde bevestiging (code blijft staan, tab wordt niet gerenderd).

### 7. Naam vergrendelen

- `KBMappingModal` krijgt de documentstatus via `useKnowledgeBaseDocuments(kb?.id)` (alleen bij bewerken).
- Naamveld `disabled` zodra documenten aanwezig zijn of de telling nog laadt; hulptekst exact: "De naam kan niet worden gewijzigd zolang er documenten in deze kennisbron staan, omdat de zoekfunctie de naam gebruikt."
- Bij 0 documenten is het veld weer bewerkbaar.
- Payload blijft `vector_collection_id` bevatten; alleen het UI-veld verdwijnt.

### 8. Meervoudig uploaden

- `input type="file" multiple`, plus drop-zone met `onDragOver`/`onDrop`.
- Bestandsvalidatie (`.pdf`, `.txt`, `.docx`) per bestand; ongeldige bestanden krijgen direct status "Fout" met reden.
- Sequentiële upload via bestaande `uploadDocument`; queue-itemstatussen: `waiting | uploading | done | error`.
- Per bestand zichtbaar: naam, status, foutreden; `aria-live="polite"` op de lijst.
- Toetsenbordalternatief: een focusbare knop opent de bestandskiezer; slepen is nooit de enige route.

### 9. UI-opschoning

- Verwijder het Vector Collection ID-veld en de Pinecone-uitleg uit `KBMappingModal`; state en payload blijven.
- Render het Kennisitems-tabblad niet meer; de code, hook en data blijven bestaan.
- Noteer in `FEATURES.md` dat het tabblad verborgen is en de data behouden blijft.

### 10. Tests (`tests/e2e/knowledge-source-manageability.spec.ts`)

1. Verwijderen vraagt om bevestiging met de documentnaam; annuleren behoudt het document; bevestigen doet de DELETE.
2. Naamveld is disabled bij een kennisbron met documenten en toont de hulptekst.
3. Multi-upload toont per bestand "Wachten"/"Uploaden"/"Klaar"/"Fout" en verstuurt per bestand een webhook.
4. Polling stopt: eerste responses bevatten `processing`, daarna `ready`; na het interval stabiliseert het aantal REST-calls.
5. "Opnieuw verwerken" bij een foutdocument toont de reden en roept `document-webhook` aan met `{ document_id, action: 'index' }`.

## Complexity Tracking

Geen constitution-violations. De enige extra afwijking van de oorspronkelijke spec ("alleen UI") is de gevraagde kolom `error_message` en de bijbehorende view; beide zijn expliciet onderdeel van de opdracht en versterken juist de bestaande RLS in plaats van die te verzwakken.
