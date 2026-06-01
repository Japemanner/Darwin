# Research: RAG Assistant Management

**Feature**: 002-rag-assistant-management | **Date**: 2026-05-30

## R0: Bestaande Codebase Analyse

### Huidige Architectuur

De applicatie (Darwin) is een **Vite SPA met directe Supabase client-side queries** — geen Next.js, geen API routes, geen server. Alle data-access loopt via `@supabase/supabase-js` in de browser.

### Huidige AI Chat Implementatie

| Aspect | Huidig | Gewenste staat (spec) |
|--------|--------|---------------------|
| Webhook URL | Per assistant (`ai_assistants.n8n_webhook_url`) | Globaal per `flow_type` in `flow_configs` |
| Payload | `{ message, conversation_id, assistant_id, organization_id, user_id }` | `{ assistant: {...}, knowledge_bases: [...], conversation: { id, history }, message }` |
| Response | `{ response: string }` | `{ answer: string, sources: [...] }` |
| Sources | Geen | JSONB in `messages.sources` |
| System prompt | Wel opgeslagen, niet verstuurd naar N8N | Opgeslagen én verstuurd in payload |
| KB koppeling | Junction table bestaat | Junction table blijft bestaan, maar KB metadata gaat mee in payload |
| Knowledge items | Alleen file-uploads (`knowledge_base_documents`) | File-uploads + text-based items (`knowledge_items`) |
| Embedding status | `processing/ready/error` op documenten | `pending/processing/done/failed` op items |
| Auth | Geen token meesturing | Bearer token uit `flow_configs` |

### Impact Analyse

**Te wijzigen bestanden (9):**
- `supabase/migrations/002_...` — Nieuw migratiebestand
- `src/types/database.types.ts` — Nieuwe types
- `src/lib/webhook.ts` — Nieuw: webhook helper
- `src/pages/AssistantsPage.tsx` — Grotendeels herschreven ChatWindow, modal aangepast
- `src/pages/KnowledgePage.tsx` — Knowledge items UI toegevoegd
- `src/pages/SettingsPage.tsx` — Nieuw: FlowConfig beheer
- `src/App.tsx` — Settings route + lazy import
- `src/components/layout/AppShell.tsx` — Settings nav item (admin only)
- `src/lib/storage.ts` — Mogelijk kleine aanpassingen voor text-based items

**Geen wijziging in:**
- Auth flow (Supabase PKCE blijft)
- Routing architectuur (react-router SPA blijft)
- Bestaande file-upload flow
- shadcn/ui componenten
- Supabase storage

---

## R1: Database Schema Strategie

### Besluit: Incrementele migratie met backward compatibiliteit

**Bestaande tables worden behouden en uitgebreid**, niet vervangen:

1. `ai_assistants`: Voeg `type` kolom toe met default `'chat'`. Maak `n8n_webhook_url` nullable.
2. `knowledge_bases`: Voeg `vector_collection_id` kolom toe.
3. `messages`: Voeg `sources` JSONB kolom toe.
4. **Nieuw**: `flow_configs` tabel voor globale webhook configuratie.
5. **Nieuw**: `knowledge_items` tabel voor text-based kennisitems.

**Reden**: Bestaande productiedata blijft intact. File-uploads blijven werken. Nieuwe functionaliteit wordt toegevoegd zonder breaking changes.

### Waarom `knowledge_items` apart en niet `knowledge_base_documents` uitbreiden?

`knowledge_base_documents` heeft velden als `file_path`, `file_type`, `file_size` die specifiek zijn voor bestanden. Text-based items hebben `title`, `content`, `source_url`. Deze concepten zijn fundamenteel verschillend — aparte tables voorkomen verwarring en houden queries eenvoudig.

Beide table types delen een `knowledge_base_id` FK en dragen bij aan dezelfde vector collection.

---

## R2: N8N Webhook Integratie

### Payload Transitie

De webhook call wordt centraal afgehandeld door `src/lib/webhook.ts`. Functie `callRagWebhook`:

1. Zoekt FlowConfig voor `flow_type = 'rag_chat'`
2. Bouwt payload volgens spec-formaat
3. Verstuurt POST met `Authorization: Bearer <token>` header
4. Handelt timeout (30s) en error states af
5. Retourneert `{ answer, sources }`

**Graceful degradation voor legacy assistants**: Als een assistant geen `type` heeft (oude data), blijft de bestaande per-assistant webhook URL gebruikt worden. Dit voorkomt breuken in productie.

### Token Encryptie

`flow_configs.webhook_token` wordt **client-side encrypted** vóór opslag en **client-side decrypted** vóór versturen naar N8N. Dit is de enige optie in een SPA zonder backend:

- Encryptie-sleutel: `VITE_ENCRYPTION_KEY` env variable (32-byte key)
- Algoritme: AES-256-GCM via Web Crypto API (`crypto.subtle`)
- Opslag: encrypted token als hex string in `webhook_token` kolom
- Bij GET op `/api/settings/flows`: `webhook_token` wordt NOOIT geretourneerd — de API response bevat alleen placeholder `"••••••••"` of het veld wordt geheel weggelaten

**Trade-off**: Client-side encryptie is minder veilig dan server-side. Dit is acceptabel voor v1 omdat de token alsnog niet in plaintext in de database staat en alleen bruikbaar is met de encryptie-sleutel die in de omgeving van de beheerder leeft. Voor v2 kan een Edge Function encryptie afhandelen.

### Response Compatibiliteit

De webhook helper ondersteunt beide response formaten:
- `{ answer: "..." }` — nieuwe format
- `{ response: "..." }` — legacy format
- Sources zijn optioneel — afwezigheid = geen bronnensectie in UI

---

## R3: UI Component Strategie

### ChatWindow Refactoring

De bestaande `ChatWindow` (<200 regels, embedded in `AssistantsPage.tsx`) wordt uitgebreid met:

1. **KB resolutie**: Bij openen van chat, laad gekoppelde KBs via `assistant_knowledge_bases` junction
2. **Payload bouw**: Gebruik `callRagWebhook` i.p.v. directe fetch
3. **Source display**: Collapsible sectie onder assistant berichten
4. **Error handling**: Timeout melding, herstelbare fouten
5. **Laadstatus**: Bestaande spinner blijft, aangevuld met expliciete timeout countdown

### Knowledge Items UI

Toegevoegd als tweede tab in de bestaande `KBSlideOver` (naast "Documenten"):

```
Tab: Documenten | Kennisitems
```

Kennisitems tab:
- Tekstveld voor title
- Grote textarea voor content
- Optioneel source_url veld
- Lijst van bestaande items met embedding status badge
- Delete knop per item

### Settings Page

Nieuwe pagina `/settings` (admin-only):
- Formulier per `flow_type: "rag_chat"`
- Velden: Webhook URL, Webhook Token (wachtwoordveld)
- Tonen: huidige configuratie (token gemaskeerd)
- Opslaan: encrypted token naar database

---

## R4: RLS Policies

Nieuwe tables hebben RLS policies nodig:

**`flow_configs`**:
- SELECT: Iedereen in de organisatie (alleen non-token velden)
- INSERT/UPDATE/DELETE: Admin only

**`knowledge_items`**:
- SELECT/INSERT/DELETE: Via `knowledge_bases` → `organization_id` check (zelfde patroon als `knowledge_base_documents`)

---

## R5: Extensibiliteit

De `type` enum op `ai_assistants` en `flow_type` op `flow_configs` gebruiken PostgreSQL CHECK constraints als enums (geen native ENUM type — makkelijker uit te breiden zonder migration):

```sql
CHECK (type IN ('chat', 'agent', 'voice'))
CHECK (flow_type IN ('rag_chat'))
```

Uitbreiding naar nieuwe types vereist alleen een migration die de CHECK constraint aanpast — geen code-wijzigingen in de applicatielogica.

---

## R6: Technische Dependencies

| Dependency | Versie | Gebruik |
|-----------|--------|---------|
| `@supabase/supabase-js` | 2.49.1 | Database queries, reeds aanwezig |
| Web Crypto API | Browser-native | AES-256-GCM encryptie |
| Geen nieuwe npm packages | — | Alle functionaliteit met bestaande stack |

---

## R7: Risico's & Mitigaties

| Risico | Impact | Mitigatie |
|--------|--------|----------|
| N8N webhook down | Chat werkt niet | Duidelijke foutmelding, retry mogelijk |
| Encryptie key verloren | Tokens niet meer te lezen | Tokens opnieuw invoeren via settings |
| Legacy assistants breken | Gebruikers kunnen oudere assistants niet gebruiken | Backward compat: `n8n_webhook_url` nullable houden, fallback logica in webhook helper |
| Grote payloads (>20 berichten) | N8N timeout | Truncatie naar laatste 20 berichten client-side |
