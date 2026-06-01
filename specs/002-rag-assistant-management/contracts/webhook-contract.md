# Webhook Contract: N8N RAG Chat

**Feature**: 002-rag-assistant-management | **Date**: 2026-05-30

## Endpoint

| Field | Value |
|-------|-------|
| Method | `POST` |
| URL | Geconfigureerd in `flow_configs.webhook_url` (per `flow_type: "rag_chat"`) |
| Auth | `Authorization: Bearer <webhook_token>` |
| Timeout | 30 seconden client-side |
| Content-Type | `application/json` |

---

## Request Payload

```json
{
  "assistant": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "HR Assistant",
    "system_prompt": "Je bent een behulpzame HR-assistent..."
  },
  "knowledge_bases": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "vector_collection_id": "hr-docs-v1"
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440002",
      "vector_collection_id": "policies-2026"
    }
  ],
  "conversation": {
    "id": "770e8400-e29b-41d4-a716-446655440003",
    "history": [
      {
        "role": "user",
        "content": "Hoeveel vakantiedagen heb ik?"
      },
      {
        "role": "assistant",
        "content": "Volgens het personeelshandboek heb je recht op 25 vakantiedagen per jaar."
      }
    ]
  },
  "message": "Geldt dat ook voor parttime medewerkers?"
}
```

### Veld specificaties

| Veld | Type | Verplicht | Omschrijving |
|------|------|-----------|-------------|
| `assistant.id` | UUID string | Ja | Unieke identifier van de assistant |
| `assistant.name` | string | Ja | Naam van de assistant |
| `assistant.system_prompt` | string | Ja | System prompt voor de LLM |
| `knowledge_bases[].id` | UUID string | Ja | ID van de kennisbron |
| `knowledge_bases[].vector_collection_id` | string | Ja | Collection/namespace in vector DB |
| `conversation.id` | UUID string | Ja | Uniek gesprek-ID voor context tracking |
| `conversation.history` | array | Ja | Chronologische berichtengeschiedenis |
| `conversation.history[].role` | `"user"` \| `"assistant"` | Ja | Rol van de afzender |
| `conversation.history[].content` | string | Ja | Berichtinhoud |
| `message` | string | Ja | De huidige gebruikersvraag |

### Truncatie

Bij > 20 berichten in `history` worden alleen de laatste 20 meegestuurd naar N8N (client-side truncatie).

### Lege knowledge_bases

Als een assistant geen gekoppelde kennisbronnen heeft, is `knowledge_bases` een lege array `[]`. N8N dient in dat geval te antwoorden op basis van alleen de system prompt.

---

## Response Payload

### Succes (200 OK)

```json
{
  "answer": "Ja, parttime medewerkers krijgen vakantiedagen naar rato...",
  "sources": [
    {
      "knowledge_item_id": "880e8400-e29b-41d4-a716-446655440004",
      "title": "Personeelshandboek 2026",
      "excerpt": "Parttime medewerkers hebben recht op vakantiedagen naar rato van hun contracturen...",
      "score": 0.92
    },
    {
      "knowledge_item_id": "880e8400-e29b-41d4-a716-446655440005",
      "title": "CAO Bijlage 4",
      "excerpt": "Berekening vakantiedagen: (contracturen / 40) * 25...",
      "score": 0.87
    }
  ]
}
```

### Veld specificaties

| Veld | Type | Verplicht | Omschrijving |
|------|------|-----------|-------------|
| `answer` | string | Ja | Het antwoord van de assistant |
| `sources` | array \| null | Nee | Bronverwijzingen (null/afwezig = geen bronnen) |
| `sources[].knowledge_item_id` | UUID string | Ja | ID van het gebruikte kennisitem |
| `sources[].title` | string | Ja | Titel van de bron |
| `sources[].excerpt` | string | Ja | Relevant fragment uit de bron |
| `sources[].score` | float (0-1) | Ja | Relevantie score |

### Legacy compatibiliteit

Het systeem ondersteunt ook het oude response formaat voor backward compatibility:

```json
{
  "response": "Het antwoord van de assistant"
}
```

Als `response` aanwezig is maar `answer` niet, wordt `response` gebruikt als antwoord. Sources zijn dan niet beschikbaar.

---

## Error Afhandeling

### Timeout (geen response binnen 30s)

De gebruiker ziet: "De assistant reageert niet. Controleer de verbinding en probeer het opnieuw."

Het user bericht blijft behouden in de chat — de gebruiker kan het opnieuw versturen.

### HTTP fout (4xx, 5xx)

| Status | Oorzaak | Melding |
|--------|---------|---------|
| 401 | Ongeldig token | "Authenticatiefout — neem contact op met de beheerder" |
| 404 | Webhook URL onjuist | "Webhook niet gevonden — controleer de configuratie" |
| 500 | N8N serverfout | "De AI-service is tijdelijk niet beschikbaar. Probeer het later opnieuw." |
| Overig | Netwerkfout | "Kon geen verbinding maken met de AI-service. Controleer je internetverbinding." |

---

## N8N Flow Verwachting (ter referentie)

De N8N webhook ontvangt bovenstaande payload en voert idealiter de volgende stappen uit:

1. **Webhook node**: Ontvangt POST request
2. **Vector retrieval**: Query de opgegeven `vector_collection_id` met `message`
3. **Context assembly**: Combineer retrieved chunks met `system_prompt` + `history` + `message`
4. **LLM call**: Genereer antwoord met context
5. **Response**: Return `{ answer, sources }` als JSON

Het Darwin-systeem heeft geen kennis van de N8N-internals — alleen het contract telt.

---

## Test Webhook (voor ontwikkeling)

Voor lokale ontwikkeling kan een eenvoudige echo-webhook gebruikt worden:

```javascript
// n8n webhook test response (bijvoorbeeld via webhook.site of lokale HTTP server)
{
  "answer": "Dit is een test-antwoord op: \"${message}\"",
  "sources": [
    {
      "knowledge_item_id": "test-item-1",
      "title": "Test Document",
      "excerpt": "Dit is een test excerpt over het onderwerp...",
      "score": 0.95
    }
  ]
}
```
