# Contract: rag-chat v2 (UI → Edge Function → n8n + database-persistentie)

**Feature**: 011-resumable-chat-page | **Date**: 2026-10-16 | **Implementatie**: `supabase/functions/rag-chat/index.ts`, client `src/lib/rag-client.ts`
**Supersedeert**: `specs/009-secure-n8n-proxy/contracts/rag-chat.md` (v1) — het commentaar in `index.ts:4` wordt meegeüpdatet naar dit contract.

## Endpoint

| Veld | Waarde |
|------|--------|
| Method | `POST` |
| URL | `{SUPABASE_URL}/functions/v1/rag-chat` |
| Auth | Supabase-sessie-JWT (`supabase.functions.invoke` voegt `Authorization: Bearer` toe) |
| Time-out | geen client-abort; server garandeert een respons binnen ~60 s (n8n-fetch-time-out, ongewijzigd) |
| Content-Type | `application/json` |

## Request (v2)

```json
{
  "assistant_id": "550e8400-e29b-41d4-a716-446655440000",
  "conversation_id": "770e8400-e29b-41d4-a716-446655440003",
  "message_id": "990e8400-e29b-41d4-a716-446655440009",
  "message": "Geldt dat ook voor parttime medewerkers?"
}
```

| Veld | Type | Verplicht | Validatie |
|------|------|-----------|-----------|
| `assistant_id` | UUID | ja | moet bestaan, zelfde organisatie, `is_active` |
| `conversation_id` | UUID | nee | indien aanwezig: eigendom `user_id = auth user` én `assistant_id` matcht |
| `message_id` | UUID | ja (v2-clients) | client-gegenereerd per vraag; blijft gelijk bij "Opnieuw proberen" |
| `message` | string | ja | niet-leeg na trim; max 10.000 tekens (bestaand) |

De client stuurt geen `conversation_id` bij de eerste vraag van een nieuw gesprek; het
vaste adres ontstaat server-side uit de respons.

### Legacy-pad (rollout, verwijderen bij de volgende rag-chat-wijziging)

Request **zonder** `message_id` = oude client: `conversation_id` is dan verplicht
(VALIDATION bij afwezigheid), er wordt **niets gepersisteerd**, en de respons heeft de
oude v1-vorm `{ answer, sources, verification, rewritten_query }`. Hierdoor kan de
Edge Function vóór de frontend worden gedePLOYd zonder de huidige productieclient te
breken (onderbouwing: [research.md](../research.md) #4).

## Serverflow (authenticatie, autorisatie, persistentie)

1. **AuthN**: JWT valideren (`serviceClient.auth.getUser`) → anders `401 UNAUTHORIZED`.
   Profiel/organisatie via userClient-RLS-read → anders `403 FORBIDDEN` (bestaand).
2. **Assistent-AuthZ**: userClient-RLS-read, `organization_id` matcht,
   `is_active` → anders `403 FORBIDDEN` (bestaand).
3. **Gespreksresolutie** (nieuw in v2, research #2) — in deze volgorde:
   a. Bericht-lookup op `message_id` (service role, PK): bestaat het bericht, dan is
      dit een retry en is `row.conversation_id` autoritatief (eventuele
      `conversation_id` uit de request wordt genegeerd);
   b. anders: `conversation_id` uit de request;
   c. anders: **nieuw gesprek aanmaken** met
      `user_id = auth user`, `assistant_id`, `title = message.trim().slice(0, 80)`
      plus `'…'` alleen bij afkapping.
4. **Eigendomscontrole** op het (nieuwe) gesprek via userClient-RLS-read:
   bestaat, `user_id = auth user`, `assistant_id = assistantId` → anders
   `403 FORBIDDEN`. Geldt óók voor de retry-route (berichten van anderen zijn niet
   leesbaar via RLS → FORBIDDEN).
5. **Gebruikersbericht upserten** (service role) met `id = message_id`,
   `conversation_id`, `role = 'user'`, `content = message`;
   `ON CONFLICT (id) DO NOTHING` — een herhaalde poging met hetzelfde bericht-id
   maakt geen dubbel bericht (acceptatiecriterium). Bestond het bericht al
   (stap 3a), wordt er niet geschreven.
6. **Historie**: laatste 20 berichten van het gesprek via userClient-RLS-read,
   chronologisch, **na** de upsert — inclusief de huidige vraag (deterministisch
   patroon, overgenomen van de huidige clientflow).
7. **n8n-aanroep**: URL-keuze, SSRF-guard, headers, 60 s time-out, payload —
   **alle ongewijzigd** t.o.v. v1 (contract 009). n8n ontvangt nooit het
   Supabase-JWT.
8. **Assistentbericht opslaan** (service role, alleen bij upstream-succes):
   `role = 'assistant'`, `content = answer`, `sources` (JSONB, ongewijzigd
   doorgestuurd) — `.select().single()` levert `id` + `created_at` voor de respons.
9. **`conversations.updated_at`** bijwerken (service role) na het opslaan van het
   antwoord (trigger `set_updated_at` bevestigt de waarde).

## Response (200 OK, v2)

```json
{
  "conversation_id": "770e8400-e29b-41d4-a716-446655440003",
  "user_message_id": "990e8400-e29b-41d4-a716-446655440009",
  "assistant_message": {
    "id": "aa0e8400-e29b-41d4-a716-446655440010",
    "content": "Ja, parttime medewerkers krijgen vakantiedagen naar rato van hun contracturen…",
    "sources": [
      { "knowledge_item_id": "…", "title": "Personeelshandboek", "excerpt": "…", "score": 0.92 }
    ],
    "created_at": "2026-10-16T12:00:00.000000Z"
  },
  "verification": { "grounded": true, "confidence": 0.9, "issues": [] },
  "rewritten_query": "vakantiedagen parttime medeweker regeling"
}
```

| Veld | Type | Verplicht | Omschrijving |
|------|------|-----------|--------------|
| `conversation_id` | UUID | ja | vast adres van het gesprek (nieuw of bestaand) |
| `user_message_id` | UUID | ja | echo van `message_id` (identiteitsbevestiging) |
| `assistant_message` | object | ja | `{ id, content, sources, created_at }` — server-opgeslagen antwoord |
| `verification` | object \| null | nee | ongewijzigd doorgegeven uit n8n (later gebruik) |
| `rewritten_query` | string \| null | nee | ongewijzigd doorgegeven uit n8n (later gebruik) |

## Fouten

Ongewijzigd t.o.v. v1: altijd JSON `{ "code", "message" }`, Nederlandse tekst, codes
`VALIDATION` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_CONFIGURED` (400),
`UPSTREAM_AUTH`/`UPSTREAM_ERROR`/`UPSTREAM_TIMEOUT`/`UPSTREAM_UNREACHABLE` (502),
`INTERNAL_ERROR` (500). Nieuwe VALIDATION-gevallen: `message_id` geen uuid; legacy-pad
zonder `conversation_id`.

Semantiek bij fouten (acceptatiecriteria): het antwoord wordt alléén bij succes
opgeslagen. Het gebruikersbericht kan bij een upstream-fout wél bewaard zijn
(opgeslagen vóór de fetch, research #3); een herhaalde poging met hetzelfde
`message_id` herstelt in hetzelfde gesprek zonder duplicaat (flow 3a). Fout-responses
bevatten nooit een antwoord of gespreks-id.

## CORS

Ongewijzigd: `ALLOWED_ORIGINS`, fail-closed, nooit `*` (contract 009).

## Logging (constitution III)

Ongewijzigd: uitsluitend foutcode, id's (`assistant_id`, `conversation_id`,
eventueel `message_id`), duur in ms. Nooit `message`, antwoord, historie, titel of
andere berichtinhoud; ook geen ruwe n8n-respons of fetch-fouttekst met URL's.

## Client

`src/lib/rag-client.ts` — typed wrapper rond `supabase.functions.invoke('rag-chat')`
(constitution V):

- request: `{ assistant_id, conversation_id?, message_id, message }`;
- respons: zod-schema op de v2-vorm (incl. `assistant_message`), met
  `RagClientError`-codes en de bestaande Nederlandse foutteksten;
- roept nooit direct `conversations`/`messages`-REST meer aan voor de chatflow;
- logt of bewaart geen berichtinhoud buiten React-state (constitution III).