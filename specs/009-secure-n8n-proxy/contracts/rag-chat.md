# Contract: rag-chat (UI → Edge Function → n8n)

**Feature**: 009-secure-n8n-proxy | **Date**: 2026-10-13 | **Implementatie**: `supabase/functions/rag-chat/index.ts`, client `src/lib/rag-client.ts`

## Endpoint

| Veld | Waarde |
|------|--------|
| Method | `POST` |
| URL | `{SUPABASE_URL}/functions/v1/rag-chat` |
| Auth | Supabase-sessie-JWT (`supabase.functions.invoke` voegt `Authorization: Bearer` toe) |
| Client-time-out | geen aparte client-abort — de server garandeert altijd een respons binnen ~60 s (n8n-fetch-time-out) |
| Content-Type | `application/json` |

## Request

```json
{
  "assistant_id": "550e8400-e29b-41d4-a716-446655440000",
  "conversation_id": "770e8400-e29b-41d4-a716-446655440003",
  "message": "Geldt dat ook voor parttime medewerkers?"
}
```

| Veld | Type | Verplicht | Validatie |
|------|------|-----------|-----------|
| `assistant_id` | UUID | ja | moet bestaan |
| `conversation_id` | UUID | ja | moet bestaan |
| `message` | string | ja | niet-leeg na trim; maximaal 10.000 tekens (server-side afgedwongen) |

De client stuurt geen tenantId, kennisbronnen, system prompt of webhook-URL
meer; de server bepaalt alles uit de sessie en de database.

## Server-validatie (authenticatie en autorisatie)

1. JWT valideren (patroon `supabase.functions/invite-user/index.ts`);
   ongeldig/afwezig → `401 UNAUTHORIZED`.
2. Domeinreads via een client die het Authorization-header van de gebruiker
   doorgeeft (RLS blijft gelden): profiel (organisatie), assistent (zelfde
   organisatie, `is_active`), gesprek (van deze gebruiker, zelfde assistent),
   gekoppelde kennisbronnen, organisatienaam, laatste 20 berichten. Leeg of
   niet-vindbaar → `403 FORBIDDEN`. De organisatie komt uitsluitend uit het
   `profiles`-record van `auth.uid()` — nooit uit de request-body of
   user-metadata.
3. URL-keuze, exact als de huidige `callRagWebhook` (src/lib/webhook.ts:218-238):
   - `assistant.type === 'chat'`: `flow_configs` (flow_type `rag_chat`) via
     de service role (`webhook_url`, `webhook_auth_header`, `webhook_token`).
     Bestaat de configuratie niet of is de URL leeg, en heeft de assistent een
     `n8n_webhook_url`: dan die URL zonder token (behoud huidig gedrag).
   - Overige types (`agent`, `voice`): altijd `assistant.n8n_webhook_url`,
     zonder token; de org-configuratie wordt voor deze types niet geraadpleegd
     (behoud huidig gedrag).
   - Geen enkele URL beschikbaar: → `400 NOT_CONFIGURED`.
   Elke uitgaande webhook-URL moet `https://` zijn en mag geen letterlijk IP,
   `localhost` of link-local host bevatten; anders `400 NOT_CONFIGURED`
   (server-side afgedwongen, ook voor de per-assistent fallback-URL).
   Bewuste kleine uitbreiding van huidig gedrag: bij type `chat` geldt de
   fallback op de per-assistent URL nu óók als er helemáál geen config-rij
   bestaat (voorheen een harde fout) — assistenten met een eigen URL blijven
   zo bruikbaar zonder gedeelde configuratie.
4. `tenantId` = organisatienaam (server-resolved).

## Payload naar n8n (bestaande velden + uitbreiding)

Basis volgens `specs/002-rag-assistant-management/contracts/webhook-contract.md`,
aangevuld met de kennisbronlijst (de oplossing voor "assistent met twee
kennisbronnen vindt niets", zie ook verbeterplan N1):

```json
{
  "assistant": { "id": "…", "name": "…", "system_prompt": "…" },
  "knowledge_bases": [
    { "id": "…", "name": "Schade", "vector_collection_id": "…" },
    { "id": "…", "name": "Acceptatie", "vector_collection_id": "…" }
  ],
  "knowledge_sources": ["Schade", "Acceptatie"],
  "knowledgeSourceName": "Schade, Acceptatie",
  "tenantId": "Organisatienaam",
  "conversation": { "id": "…", "history": [ { "role": "user", "content": "…" } ] },
  "message": "…"
}
```

- `knowledge_sources`: **nieuw**, `string[]` — elke kennisbronnaam als
  afzonderlijk item.
- `knowledgeSourceName`: **legacy** (namen gescheiden door `", "`), blijft
  meegaan totdat n8n is overgeschakeld op `knowledge_sources` (verbeterplan N1).
- `history`: laatste 20 berichten, chronologisch (zelfde truncatie als nu).
- Lege kennisbronnenlijst: `knowledge_bases: []`, `knowledge_sources: []`,
  `knowledgeSourceName: ""` (zelfde gedrag als nu).
- n8n ontvangt nooit het Supabase-JWT; alleen de geconfigureerde header
  (standaard `X-Webhook-Token`) met het webhook-token.

## Response (200 OK)

```json
{
  "answer": "Ja, parttime medewerkers krijgen vakantiedagen naar rato…",
  "sources": [
    { "knowledge_item_id": "…", "title": "Personeelshandboek", "excerpt": "…", "score": 0.92 }
  ],
  "verification": { "grounded": true, "confidence": 0.9, "issues": [] },
  "rewritten_query": "vakantiedagen parttime medeweker regeling"
}
```

| Veld | Type | Verplicht | Omschrijving |
|------|------|-----------|--------------|
| `answer` | string | ja | Antwoord; bij een niet-herkenbaar n8n-antwoord de geporteerde fallback "Geen antwoord ontvangen" (poort van `extractWebhookResponse`, incl. legacy `response`-veld) |
| `sources` | array \| null | nee | Bronverwijzingen uit n8n, **ongewijzigd doorgestuurd** inclusief `knowledge_item_id`, `title`, `excerpt`, `score` — de huidige UI rendert het score-percentage tot feature F dit vervangt |
| `verification` | object \| null | nee | Gemapt uit de n8n-velden `verification_grounded`, `verification_confidence`, `verification_issues`; de UI gebruikt dit pas in latere features (E/F) |
| `rewritten_query` | string \| null | nee | Uit n8n `rewritten_query`; pas relevant voor latere features |

## Fouten

Altijd JSON `{ "code": string, "message": string }` met Nederlandse tekst.
De client (`src/lib/rag-client.ts`) mapt elke code naar een vaste Nederlandse
melding en valideert de succesresponse met zod (constitution V).

| HTTP | Code | Situatie | Melding (client-tekst) |
|------|------|----------|------------------------|
| 401 | `UNAUTHORIZED` | Geen of ongeldig sessie-JWT | "Uw sessie is verlopen. Log opnieuw in." |
| 403 | `FORBIDDEN` | Assistent, gesprek of organisatie van een andere tenant | "U heeft geen toegang tot deze assistent of dit gesprek." |
| 400 | `NOT_CONFIGURED` | Geen webhook-URL geconfigureerd | "Er is geen koppeling geconfigureerd. Neem contact op met de beheerder." |
| 502 | `UPSTREAM_AUTH` | n8n geeft 401/403 | "De koppeling weigert de verbinding. Controleer het token en de headernaam in de instellingen." |
| 502 | `UPSTREAM_ERROR` | n8n geeft een andere foutstatus (404, 429, 5xx, …) | "De assistent-service gaf een fout. Probeer het opnieuw of neem contact op met de beheerder." |
| 502 | `UPSTREAM_TIMEOUT` | n8n reageert niet binnen 60 s | "De assistant reageert niet binnen de toegestane tijd. Probeer het opnieuw." |
| 502 | `UPSTREAM_UNREACHABLE` | n8n onbereikbaar (netwerk/DNS) | "Kon geen verbinding maken met de assistent-service." |

## CORS

`Access-Control-Allow-Origin` komt uit de omgevingsvariabele
`ALLOWED_ORIGINS` (komma-gescheiden). Fail-closed: is de variabele niet
gezet, of matcht de `Origin`-header niet, dan wordt **geen**
`Access-Control-Allow-Origin`-header meegestuurd (de browser blokkeert het
antwoord) — nooit `*`, nooit een fallback. De OPTIONS-preflight volgt
dezelfde regel.

## Logging (constitution III)

De Edge Function logt uitsluitend: foutcode, assistent-/gesprek-/organisatie-id
en duur. Nooit: `message`, `answer`, `history`, tokens of andere
berichtinhoud. Log ook nooit de ruwe n8n-response of requestpayload, en geen
fetch-foutmeldingen die de webhook-URL bevatten — alleen de getypeerde code.

## Client

`src/lib/rag-client.ts` — typed wrapper rond
`supabase.functions.invoke('rag-chat')`: zod-validatie van de succesresponse,
`RagClientError` met bovenstaande codes, Nederlandse fouttekst per code.
De client stuurt nooit tenant-gegevens of berichtinhoud mee die de server niet
zelf bepaalt, en logt geen berichtinhoud.