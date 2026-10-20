# Contract: Per-antwoord feedback — REST-upsert en beheerdersfunctie

**Date**: 2026-10-19 | **Feature**: [spec.md](../spec.md) | **Branch**: `012-per-answer-feedback`

Dit contract beschrijft de twee database-interfaces van de feature: de REST-upsert
die de chat-UI gebruikt, en de beheerdersfunctie. Het rag-chat v2-responscontract
([specs/011-resumable-chat-page/contracts/rag-chat.md](../../011-resumable-chat-page/contracts/rag-chat.md))
verandert niet.

## 1. Upsert antwoordoordeel (supabase-js REST)

```ts
supabase.from('feedback_interactions').upsert({
  message_id:       messageId,        // uuid van het assistentbericht — conflict-key
  conversation_id:  conversationId,   // uuid, NOT NULL
  assistant_id:     assistantId,      // uuid, NOT NULL
  user_id:          userId,           // uuid van ingelogde gebruiker, NOT NULL
  organization_id:  organizationId,   // uuid uit profile, NOT NULL
  thumbs_up:        boolean,
  reason:           thumbs_up ? null : 'incorrect' | 'incomplete' | 'wrong_source' | 'misunderstood' | 'other',
  feedback:         toelichting ?? null,   // optioneel, alleen betekenisvol bij omlaag
}, { onConflict: 'message_id,user_id' })
```

| Regel | Gedrag |
|---|---|
| Nieuw oordeel | rij wordt aangemaakt |
| Bestaand oordeel op `(message_id, user_id)` | **volledige** overschrijving van alle meegestuurde kolommen — reden en toelichting zijn bij duim omhoog expliciet `null` |
| `updated_at` | nooit meesturen; trigger zet de waarde bij elke UPDATE |
| `created_at` | nooit meesturen; default blijft staan bij overschrijving (moment van eerste oordeel) |

Foutgedrag (NL toast in de UI, geen stille mislukking):

| Status | Oorzaak | UI |
|---|---|---|
| 42501 | RLS: bericht niet in eigen gesprek (of `message_id` null/verzonnen) | "Kon uw beoordeling niet opslaan. Probeer het opnieuw." |
| 42703 | migratie nog niet toegepast (kolom bestaat niet) | idem — rolloutvolgorde voorkomt dit (quickstart) |
| 23514 | CHECK-schending reason (kan via UI niet voorkomen) | idem |

Redencodes (DB-code ↔ UI-label, constitution I):

| Code | Label |
|---|---|
| `incorrect` | Onjuist |
| `incomplete` | Onvolledig |
| `wrong_source` | Bron klopt niet |
| `misunderstood` | Vraag niet begrepen |
| `other` | Anders |

Lezen (per gesprek, één request): `GET /rest/v1/feedback_interactions?select=*&conversation_id=<uuid>&user_id=<uuid>&message_id=not.is.null` — RLS beperkt tot eigen rijen; oude gespreksbrede rijen (message_id NULL) worden uitgefilterd en nooit getoond (FR-009).

## 2. Beheerdersfunctie `get_feedback_review()`

Aanroep: `supabase.rpc('get_feedback_review')` — geen argumenten; rol en organisatie
worden server-side vastgesteld uit de JWT (`is_org_admin()`, `get_user_org_id()`).

Retourneert: array van rijen (alleen **negatieve** antwoordoordelen van de eigen
organisatie), per rij:

| Veld | Type | Betekenis |
|---|---|---|
| `feedback_id` | uuid | id van het oordeel |
| `message_id` | uuid | beoordeelde antwoordbericht |
| `conversation_id` | uuid | gesprek |
| `assistant_id` | uuid | assistent |
| `assistant_name` | text | assistentnaam |
| `reason` | text | redencode (§1) — altijd gevuld bij negatief oordeel |
| `feedback` | text \| null | optionele toelichting |
| `question` | text \| null | jongste gebruikersbericht vóór het antwoord (null alleen bij pre-012-data) |
| `answer` | text | antwoordtekst |
| `verification` | jsonb \| null | `{ grounded, confidence, issues }` of null (pre-012) |
| `rewritten_query` | text \| null | herschreven zoekvraag of null (pre-012/niet geleverd) |
| `latency_ms` | integer \| null | doorlooptijd vraag→antwoord of null (pre-012) |
| `created_at` | timestamptz | moment van eerste oordeel |
| `updated_at` | timestamptz | moment van laatste wijziging |

Autorisatiegedrag:

| Aanroeper | Resultaat |
|---|---|
| beheerder, eigen organisatie | alle negatieve antwoordoordelen van die organisatie |
| gewone gebruiker (member) | lege array — géén fout, géén data (is_org_admin() faalt zacht) |
| beheerder organisatie A | nooit rijen van organisatie B (WHERE organization_id = get_user_org_id()) |

Geen UI-beheerscherm (buiten scope); afnemers zijn SQL-editor/Supabase MCP en latere
features. De functie is `SECURITY DEFINER` met vaste `search_path = public` en omzeilt
daarmee bewust de bericht-RLS (een view met security_invoker zou voor beheerders leeg
blijven — research #4).