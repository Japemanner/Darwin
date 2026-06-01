# Implementation Plan: Kennisbron Documenten — Darwin↔N8N Integratie

**Branch**: `001-knowledge-source-documents` | **Date**: 2026-05-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-knowledge-source-documents/spec.md`

## Summary

Breid de bestaande document-upload functionaliteit in Darwin uit met een correcte N8N webhook payload. Bij documentupload wordt een gesigneerde Supabase Storage download URL gegenereerd (15 minuten geldig) en verstuurd naar N8N samen met `tenant_id`, `document_name`, en `document_type`. Voegt client-side bestandstype validatie toe. Geen database-schema wijzigingen — de feature is puur een applicatielogica-aanpassing op twee bestaande bestanden.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), React 18

**Primary Dependencies**: `@supabase/supabase-js` v2 (voor `createSignedUrl`), React, Tailwind CSS v3, shadcn/ui

**Storage**: Supabase Storage bucket `knowledge-documents` (bestaand), PostgreSQL `knowledge_base_documents` tabel (bestaand)

**Testing**: Playwright (via Playwright MCP — geen unit tests aanwezig in codebase)

**Target Platform**: Web (Netlify SPA, moderne browsers)

**Project Type**: Single-page web application (frontend-only, backend via Supabase + N8N)

**Performance Goals**: Upload + signed URL generatie + webhook call < 5 seconden (SC-001)

**Constraints**: Geen nieuwe dependencies, geen database migraties, must work zonder N8N webhook geconfigureerd (graceful degradation)

**Scale/Scope**: 2 bestaande bestanden gewijzigd (`storage.ts`, `KnowledgePage.tsx`), ~50 regels code toegevoegd

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

De constitution is een placeholder template en bevat geen geprojecteerde regels. Alle project-specifieke regels komen uit `AGENTS.md`:

| Regel | Status | Opmerking |
|-------|--------|----------|
| RLS op elke tabel | ✅ | Bestaande tabellen hebben RLS, geen nieuwe tabellen |
| Geen secrets in client code | ✅ | Alleen anon key in frontend, webhook URL via env var |
| PKCE auth flow | ✅ | Ongewijzigd |
| TypeScript strict mode | ✅ | Geen `any` types toegevoegd |
| Netlify redirects voor SPA | ✅ | Ongewijzigd |
| Storage bucket policies | ✅ | Bestaande bucket, geen wijzigingen |
| Edge Functions voor privileged operations | ✅ | Niet nodig voor deze feature |

## Project Structure

### Documentation (this feature)

```text
specs/001-knowledge-source-documents/
├── spec.md                  # Feature specification
├── plan.md                  # This file
├── research.md              # Phase 0: technical research
├── data-model.md            # Phase 1: data model (hergebruikt bestaand)
├── quickstart.md            # Phase 1: developer quickstart
├── contracts/
│   └── webhook-payload.md   # Phase 1: N8N webhook contract
├── checklists/
│   └── requirements.md      # Spec quality checklist
└── tasks.md                 # Phase 2: /speckit.tasks (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── lib/
│   └── storage.ts           # WIJZIGEN: uploadDocument uitbreiden
├── pages/
│   └── KnowledgePage.tsx    # WIJZIGEN: bestandstype validatie, aanroep aanpassen
├── types/
│   └── database.types.ts    # ONGEWIJZIGD
└── vite-env.d.ts            # ONGEWIJZIGD
```

**Structure Decision**: Single-project structuur (bestaand). Geen nieuwe bestanden — wijzigingen uitsluitend in `src/lib/storage.ts` en `src/pages/KnowledgePage.tsx`.

## Complexity Tracking

> Geen violations — de feature gebruikt uitsluitend bestaande infrastructuur en voegt geen nieuwe abstracties toe.

## Architecture & Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        KnowledgePage.tsx                         │
│                                                                  │
│  1. Gebruiker selecteert bestand                                 │
│  2. Client-side validatie (extensie check)                       │
│  3. Aanroep uploadDocument(file, kbId, userId, orgId)            │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                     src/lib/storage.ts                           │
│                                                                  │
│  uploadDocument(file, kbId, userId, orgId):                      │
│    1. Upload naar Supabase Storage (bestaand)                    │
│    2. Insert record in knowledge_base_documents (bestaand)       │
│    3. createSignedUrl(filePath, 900) — NIEUW                     │
│    4. POST naar VITE_N8N_DOCUMENT_WEBHOOK — AANGEPAST            │
│       payload: { tenant_id, document_name, document_type,        │
│                  download_url }                                  │
│    5. Return { document, signedUrl }                             │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                         N8N Webhook                              │
│                                                                  │
│  Ontvangt: { tenant_id, document_name, document_type,            │
│              download_url }                                      │
│                                                                  │
│  N8N-flow:                                                        │
│    1. Download document via gesigneerde URL (binnen 15 min)      │
│    2. Chunk + embed in vector database                           │
│    3. Update knowledge_base_documents.status → 'ready'/'error'   │
│       (via Supabase service role key)                            │
└─────────────────────────────────────────────────────────────────┘
```

## Key Implementation Decisions

### D1: Webhook call verplaatsen naar storage.ts

De webhook call zat in `KnowledgePage.tsx` als inline fetch. Verplaatst naar `storage.ts` naast de upload logica, zodat de functie self-contained is en de page component alleen met UI-zaken bezig is.

### D2: `createSignedUrl` gebruiken i.p.v. `getPublicUrl`

`getPublicUrl` genereert een permanente URL zonder expiry. `createSignedUrl` genereert een URL met configurable TTL (900 seconden = 15 minuten). Dit sluit aan bij de requirement dat de download URL 15 minuten geldig moet zijn.

### D3: `tenant_id` als expliciet veld in webhook payload

De requirement specificeert `tenant_id` als veldnaam. In de bestaande codebase heet dit `organization_id`. We mappen `organization_id` → `tenant_id` in de webhook payload zodat N8N de verwachte veldnaam ontvangt.

### D4: Geen retry-logica op webhook

De webhook is fire-and-forget. Als N8N onbereikbaar is, faalt de call silently. De gebruiker ziet geen foutmelding en het document is wel opgeslagen. N8N kan later niet alsnog de URL gebruiken (deze is na 15 min verlopen) — dit is een known trade-off. Een retry-mechanisme of webhook-queue valt buiten scope van v1.

## Files to Change

### `src/lib/storage.ts`

**Huidige staat**: `uploadDocument` uploadt naar storage, insert DB record, returnt document. `getDocumentPublicUrl` wordt apart aangeroepen. Geen webhook integratie in deze file.

**Nieuwe staat**:
- `uploadDocument` retourneert `{ document, signedUrl }` 
- Genereert signed URL via `createSignedUrl(filePath, 900)`
- Verstuurt webhook met uitgebreide payload
- Webhook call wrapped in try/catch — faalt silently
- `getDocumentPublicUrl` blijft bestaan voor UI-doeleinden (niet voor N8N)

### `src/pages/KnowledgePage.tsx`

**Huidige staat**: `handleUpload` roept `uploadDocument` aan, refresht documentenlijst, verstuurt fire-and-forget webhook met minimale payload direct in de component.

**Nieuwe staat**:
- Bestandstype validatie vóór upload (check op `.pdf`, `.txt`, `.docx`)
- Webhook call verwijderd uit de component (verplaatst naar storage.ts)
- `uploadDocument` aanroep blijft hetzelfde, maar returnt nu ook signedUrl
- Foutmelding bij ongeldig bestandstype via toast
