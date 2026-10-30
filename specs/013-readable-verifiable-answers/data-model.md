# Data Model: Antwoorden leesbaar, controleerbaar en als CONCEPT gemarkeerd

**Date**: 2026-10-29 | **Feature**: [spec.md](spec.md) | **Branch**: `013-readable-verifiable-answers`

**Geen database-migraties, geen Edge Function-wijzigingen.** Alle data in deze feature
bestaat al: het betreft UI-state en het zichtbaar maken van reeds gepersisteerde
velden (`messages.verification` en `messages.sources`, jsonb sinds migratie 017 /
feature 012). Dit document beschrijft de entiteiten zoals de frontend ze gebruikt.

## Entiteiten

### ChatMessage (in-memory UI-state, `MessageBubble.tsx`)

| Veld | Type | Herkomst |
|------|------|----------|
| `id` | `string` | live: server-antwoord of client-uuid; herladen: `messages.id` |
| `role` | `'user' \| 'assistant'` | idem |
| `content` | `string` | `messages.content` |
| `sources` | `unknown` | live: `RagSource[] \| null` (zod-case uit de edge-respons); herladen: ruwe jsonb-array — consumers narrowen met `Array.isArray` |
| `verification` | `RagVerification \| null \| undefined` (nieuw) | live: `RagChatResult.verification`; herladen: `parseVerification(messages.verification)`; `undefined` = veld niet gezet (userberichten, nog niet gevulde velden) |
| `created_at` | `string` | idem |
| `status` | `'pending' \| 'sent' \| 'failed'` | UI-only |
| `error` | `{ code: string; message: string } \| undefined` | UI-only |

### RagVerification (bestaand type `rag-client.ts`; display-vorm van de jsonb-kolom)

| Veld | Type | Regels |
|------|------|--------|
| `grounded` | `boolean` | `false` triggert altijd de waarschuwing |
| `confidence` | `number` | vergelijking met `CONFIDENCE_THRESHOLD = 0.7` (strikt `<`) |
| `issues` | `string[]` | alleen getoond bij een waarschuwing én `issues.length > 0` |

Persistente vorm (`messages.verification`, jsonb uit migratie 017):
`{ grounded: boolean, confidence: number, issues: string[] }` of `null`. Oude
berichten (vóór 012) hebben `null` → géén verificatieregel, géén foutmelding (FR-007).
Narrowing van de databaserij (`Record<string, unknown> \| null`) via
`parseVerification` (zod `safeParse`; `null` bij afwezig of ongeldig formaat).

### RagSource (bestaand type `rag-client.ts`, +optioneel veld)

| Veld | Type | Opmerking |
|------|------|-----------|
| `knowledge_item_id?` | `string` | ongebruikt in de display |
| `title?` | `string` | `document` in het bronpaneel; fallback `'Zonder titel'` |
| `excerpt?` | `string` | `passage` in het bronpaneel |
| `score?` | `number` | **wordt nergens meer getoond** (FR-008) |
| `page?` | `string` (nieuw) | `locatie` in het bronpaneel; `?? ''` zolang n8n nog geen locatie levert |

### BronRef-mapping (chatbron → paneelweergave, in `AnswerMeta.tsx`)

| BronRef-veld | Mapping | Contract |
|--------------|---------|-----------|
| `id` | `'K' + (index + 1)` | matcht `BronRefIdSchema` `^[KRA][0-9]+$` (K = kennisbron, analyseconventie); nummering per antwoord, 1-gebaseerd — gelijk aan het knopnummer `[1]`, `[2]` |
| `document` | `title ?? 'Zonder titel'` | niet-leeg (type-eis `BronRef`) |
| `locatie` | `page ?? ''` | leeg zolang n8n geen locatie levert; paneel verbergt het Locatie-blok bij lege waarde |
| `passage` | `excerpt ?? ''` | letterlijk fragment |

Chatbronnen worden geconstrueerd (niet door `BronRefSchema` gevalideerd — dat schema
geldt alleen voor analyse-API-resultaten); `locatie: ''` is type-conform
(`z.infer` geeft `string`).

### Bronpaneel-state (in-memory UI-state, `MessageList.tsx`)

| Veld | Type | Regels |
|------|------|--------|
| `bronnen` | `BronRef[]` | gemapte bronnen van het antwoord waaruit geopend is |
| `bronId` | `string` | actieve bron-id (`'K1'`, `'K2'`, …) |
| `trigger` | `HTMLButtonElement` | de bronknop die opende; ontvangt de focus bij sluiten (guard: `isConnected`) |

Eén instantie per chatpagina; `null` = paneel dicht (`SourcePanel` krijgt
`bronId: null`, `bronnen: []`).

## Validatieregels

1. `parseVerification(value)`: alleen een object met `grounded: boolean`,
   `confidence: number`, `issues: string[]` wordt een `RagVerification`; alles anders
   (afwezig, incompleet, corrupt jsonb) → `null` → géén verificatieregel en géén
   foutmelding (spec edge case).
2. `CONFIDENCE_THRESHOLD = 0.7`: waarschuwing bij `!grounded || confidence < 0.7`;
   "Gecontroleerd tegen de bronnen" bij `grounded && confidence >= 0.7`; confidence
   exact `0.7` met `grounded = true` → géén waarschuwing.
3. Bron-id's volgen `^[K][0-9]+$` (paneel zoekt op `bronId`).
4. Gebruikersvragen ondergaan géén markdown- of HTML-interpretatie (letterlijke
   rendering door React-escaping); assistentcontent uitsluitend via
   `sanitizeMarkdown`.

## Statustransities bronpaneel

```text
dicht (null)
   └─ onOpenBron(bronnen, bronId, trigger)  [klik of Enter/Space op bronknop]
        → open ({ bronnen, bronId, trigger })          — panel toont de bron,
                                                        focus staat op de
                                                        paneel-sluitknop
open
   ├─ onOpenBron(…) met andere bron/knop   → open (nieuwe bron, nieuwe trigger)
   ├─ Escape (document-keydown)           → dicht + trigger.focus()
   └─ onClose (sluitknop)                 → dicht + trigger.focus()
open → dicht bij conversationId-wissel (navigatie tussen gesprekken; eerste
        antwoord maakt het vaste adres — daar kan het paneel nog niet open zijn)
```

Ongeacht het aantal antwoorden bestaat één panelinstantie: FR-012 ("hooguit één
paneel tegelijk") is per constructie gegarandeerd.