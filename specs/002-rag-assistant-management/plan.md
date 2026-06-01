# Implementation Plan: RAG Assistant Management

**Branch**: `002-rag-assistant-management` | **Date**: 2026-05-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-rag-assistant-management/spec.md`

## Summary

Transformeer het bestaande Darwin AI-assistent platform van per-assistant N8N webhooks naar een **gedeelde, generieke RAG-architectuur**. De core wijziging: alle assistants van type `chat` delen één `FlowConfig` met webhook URL + encrypted token. De webhook payload wordt gestandaardiseerd met assistant metadata, knowledge base verwijzingen, en conversatiehistorie. Nieuwe `knowledge_items` tabel voor text-based kennis naast bestaande file-uploads. Sources uit N8N responses worden opgeslagen en getoond als uitklapbare bronverwijzingen. Admin-only instellingenpagina voor FlowConfig beheer.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), React 18.3

**Primary Dependencies**: `@supabase/supabase-js` 2.49.1, `react-router-dom` 6.28, `zustand` 5.0, `@tanstack/react-query` 5.62, Tailwind CSS 3.4, shadcn/ui (hand-rolled), Web Crypto API (browser-native)

**Storage**: Supabase PostgreSQL (bestaand + 2 nieuwe tables, 3 bestaande tables uitgebreid)

**Testing**: Playwright MCP (geen unit tests in codebase)

**Target Platform**: Web — Netlify SPA, moderne browsers

**Project Type**: Single-page web application (client-side only, backend via Supabase + N8N)

**Performance Goals**: Webhook roundtrip < 10 seconden (SC-002), UI responsief onder 10K berichten

**Constraints**: Geen nieuwe npm dependencies, geen backend services, backward compatibel met bestaande data

**Scale/Scope**: ~9 bestanden gewijzigd/nieuw, migration met 3 ALTER + 2 CREATE TABLE, 1 nieuwe pagina, 1 nieuwe library module

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Alle regels uit `AGENTS.md`:

| Rule | Status | Notes |
|------|--------|-------|
| RLS on every table | ✅ | `flow_configs` en `knowledge_items` krijgen volledige RLS policies |
| No secrets in client code | ✅ | Token encrypted via `VITE_ENCRYPTION_KEY`, never exposed in GET responses |
| PKCE auth flow | ✅ | Unchanged |
| TypeScript strict mode | ✅ | No `any` types added |
| Netlify redirects for SPA | ✅ | Unchanged |
| Storage bucket policies | ✅ | Unchanged |
| Edge Functions for privileged operations | ✅ | Not needed — client-side encrypt/decrypt for v1 |
| Single Supabase client instance | ✅ | Reuse existing `src/lib/supabase.ts` |

## Project Structure

### Documentation (this feature)

```text
specs/002-rag-assistant-management/
├── spec.md                  # Feature specification
├── plan.md                  # This file
├── research.md              # Phase 0: technical research
├── data-model.md            # Phase 1: data model (DDL + type updates)
├── quickstart.md            # Phase 1: developer quickstart
├── contracts/
│   └── webhook-contract.md  # Phase 1: N8N webhook payload contract
├── checklists/
│   └── requirements.md      # Spec quality checklist
└── tasks.md                 # Phase 2: /speckit.tasks (NOT created here)
```

### Source Code (repository root)

```text
# Migration (new)
supabase/
└── migrations/
    └── 002_rag_assistant_management.sql  ← NIEUW

# Types (modified)
src/
└── types/
    └── database.types.ts                 ← WIJZIGEN: nieuwe tables + kolommen

# Library modules (new + modified)
src/
└── lib/
    ├── supabase.ts                       ← ONGEWIJZIGD
    ├── storage.ts                        ← MOGELIJK WIJZIGEN: text-based items
    ├── webhook.ts                        ← NIEUW: callRagWebhook, encryptToken, decryptToken
    └── utils.ts                          ← ONGEWIJZIGD

# Pages (modified + new)
src/
└── pages/
    ├── AssistantsPage.tsx                ← WIJZIGEN: ChatWindow refactor, modal met KB-selector
    ├── KnowledgePage.tsx                 ← WIJZIGEN: knowledge_items tab in slideover
    ├── SettingsPage.tsx                  ← NIEUW: admin FlowConfig beheer
    ├── DashboardPage.tsx                 ← ONGEWIJZIGD
    └── TeamPage.tsx                      ← ONGEWIJZIGD

# App structure (modified)
src/
├── App.tsx                               ← WIJZIGEN: Settings route + lazy import
└── components/
    └── layout/
        └── AppShell.tsx                  ← WIJZIGEN: Settings nav item (admin only)
```

**Structure Decision**: Single-project SPA (bestaand). Wijzigingen uitsluitend binnen bestaande `src/` structuur. Geen nieuwe services of backend layers — alle logica in library modules en page components.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Client-side token encryptie | Geen server in SPA-architectuur | Edge Function encryptie overwogen maar toegevoegd als v2 — vereist extra deploy stap en auth flow wijziging |
| `knowledge_items` naast `knowledge_base_documents` | Fundamenteel verschillende datatypes (text vs file) | Eén table met nullable file fields overwogen maar leidt tot verwarrende queries en nullable velden |

## Architecture & Data Flow

```
┌──────────────────────────────────────────────────────────────┐
│                     ChatWindow UI                             │
│                                                               │
│  1. User types message → Enter                               │
│  2. Message added to local state (optimistic)                 │
│  3. Message saved to DB                                      │
│  4. callRagWebhook() aangeroepen                             │
│  5. Spinner getoond                                          │
└─────────────┬────────────────────────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────────────────────┐
│                src/lib/webhook.ts                             │
│                                                               │
│  callRagWebhook(assistant, conversation, message):            │
│    1. Load FlowConfig for flow_type='rag_chat'                │
│    2. Load assistant_knowledge_bases + knowledge_bases        │
│    3. Resolve conversations → messages (last 20)              │
│    4. Decrypt webhook_token                                   │
│    5. Build payload per spec                                  │
│    6. POST to webhook_url with Bearer token                   │
│    7. Parse response (answer/sources)                         │
│    8. Return { answer, sources }                              │
│                                                               │
│  encryptToken(plaintext: string): Promise<string>             │
│    → AES-256-GCM via crypto.subtle                            │
│                                                               │
│  decryptToken(ciphertext: string): Promise<string>            │
│    → AES-256-GCM via crypto.subtle                            │
└─────────────┬────────────────────────────────────────────────┘
              │ POST { assistant, knowledge_bases, conversation, message }
              │ Authorization: Bearer <decrypted_token>
              ▼
┌──────────────────────────────────────────────────────────────┐
│                      N8N Webhook                              │
│                                                               │
│  Ontvangt payload → query vector DB → LLM → respond           │
│  Response: { answer: string, sources?: Source[] }             │
└─────────────┬────────────────────────────────────────────────┘
              │ { answer, sources }
              ▼
┌──────────────────────────────────────────────────────────────┐
│                     ChatWindow UI                             │
│                                                               │
│  6. Assistant message toegevoegd aan state                    │
│  7. Message + sources opgeslagen in DB                        │
│  8. Sources getoond als collapsible onder antwoord            │
└──────────────────────────────────────────────────────────────┘
```

## Key Implementation Decisions

### D1: Backward compatibiliteit

**Besluit**: Oude per-assistant `n8n_webhook_url` blijft werken. Maak het veld nullable. Nieuwe chat logica checkt eerst op FlowConfig — als die niet bestaat, valt terug op `assistant.n8n_webhook_url` (legacy mode). Dit voorkomt dat bestaande productie-assistants breken.

### D2: Token encryptie in de browser

**Besluit**: Encryptie gebeurt client-side met Web Crypto API (`AES-256-GCM`). De token wordt als `hex` string opgeslagen in `flow_configs.webhook_token`. `VITE_ENCRYPTION_KEY` is de 32-byte sleutel — opgeslagen in `.env.local` en nooit gecommit. Trade-off: client-side encryptie is theoretisch minder veilig dan server-side, maar voorkomt dat de token in plaintext in de database staat. Acceptabel voor v1.

### D3: Sources als JSONB in messages

**Besluit**: `sources` wordt opgeslagen als JSONB op de `messages` tabel — niet als aparte reference table. Dit sluit aan bij de spec waar sources een optionele eigenschap van messages zijn. JSONB maakt flexible querying mogelijk zonder extra joins.

### D4: Knowledge items als aparte table

**Besluit**: `knowledge_items` naast `knowledge_base_documents` — niet vervangen of mergen. Text-based items hebben fundamenteel andere velden (title, content, source_url) dan file-based items (file_path, file_type, file_size). Aparte tables houden queries voorspelbaar en voorkomen nullable velden.

### D5: ChatWindow refactor scope

**Besluit**: Bestaande `ChatWindow` in `AssistantsPage.tsx` wordt uitgebreid — niet geëxtraheerd naar apart bestand. De huidige code is ~200 regels en bevat de volledige logica die uitgebreid moet worden. Extractie naar apart component voegt onnodige refactoring toe aan deze feature. Extraction blijft een aparte refactoring-taak voor later.

### D6: Settings pagina autorisatie

**Besluit**: Settings pagina is alleen zichtbaar/navigeerbaar voor admins via `profile.role === 'admin'` check in AppShell + ProtectedRoute. De Supabase RLS policies op `flow_configs` bieden defense-in-depth — non-admin insert/update/delete wordt ook op database-niveau geblokkeerd.

## Files to Change

### SUPABASE: `supabase/migrations/002_rag_assistant_management.sql` (NEW)

Nieuwe migration met:
- `ALTER TABLE ai_assistants ADD type, ALTER n8n_webhook_url DROP NOT NULL`
- `ALTER TABLE knowledge_bases ADD vector_collection_id`
- `ALTER TABLE messages ADD sources JSONB`
- `CREATE TABLE flow_configs` met RLS policies
- `CREATE TABLE knowledge_items` met RLS policies
- Triggers voor `updated_at`

### TYPES: `src/types/database.types.ts` (MODIFY)

Uitbreiden met:
- `ai_assistants`: `type` kolom
- `knowledge_bases`: `vector_collection_id` kolom
- `messages`: `sources` JSONB kolom
- Nieuwe `flow_configs` table entry
- Nieuwe `knowledge_items` table entry
- Nieuwe export types: `FlowConfig`, `KnowledgeItem`

### LIB: `src/lib/webhook.ts` (NEW)

Nieuwe module met 3 exports:
- `encryptToken(plaintext: string): Promise<string>` — AES-256-GCM
- `decryptToken(ciphertext: string): Promise<string>` — AES-256-GCM
- `callRagWebhook(assistant, conversation, message): Promise<{answer, sources}>` — orchestreert de hele flow

### PAGES: `src/pages/AssistantsPage.tsx` (MODIFY)

Wijzigingen in `AssistantModal`:
- KB-selector toegevoegd (multi-select van beschikbare knowledge_bases)
- Webhook URL veld vervangen door type selector (of verwijderd — FlowConfig bepaalt dit)
- Bij opslaan: junction table `assistant_knowledge_bases` vullen/updaten

Wijzigingen in `ChatWindow`:
- Bij openen: laad gekoppelde KBs via junction table
- `handleSend`: gebruik `callRagWebhook` i.p.v. directe fetch
- Response parsing: `answer` + `sources`
- Sources display: collapsible sectie onder assistant berichten
- Timeout handling: 30s timeout met foutmelding
- History truncation: max 20 messages naar N8N

### PAGES: `src/pages/KnowledgePage.tsx` (MODIFY)

Toevoegen aan `KBSlideOver`:
- Derde tab "Kennisitems" naast "Documenten" en "Gekoppelde assistenten"
- Inhoud:
  - Form: title + content textarea + source_url
  - Lijst van bestaande items met embed status badge
  - Delete knop per item
- `vector_collection_id` veld toevoegen aan `KBMappingModal`

### PAGES: `src/pages/SettingsPage.tsx` (NEW)

Nieuwe admin-only pagina:
- Toont `GET` bestaande `flow_configs` (webhook_url zichtbaar, token gemaskeerd)
- Form voor `PUT` update: webhook_url + webhook_token input
- Token encryptie vóór opslag naar database
- Success/error toast feedback
- Lazy-loaded in App.tsx

### APP: `src/App.tsx` (MODIFY)

Toevoegen:
- `const SettingsPage = lazy(() => import('@/pages/SettingsPage'))`
- Route: `<Route path="/settings" element={<SettingsPage />} />` binnen ProtectedRoute + AppShell

### LAYOUT: `src/components/layout/AppShell.tsx` (MODIFY)

Toevoegen aan `navItems`:
- `{ href: '/settings', label: 'Instellingen', icon: Settings }` (import `Settings` van lucide-react)
- Filter: alleen zichtbaar voor admins (zelfde patroon als Team)
