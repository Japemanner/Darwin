# Contract: chatbron-weergave en verificatieregel (UI)

**Feature**: 013-readable-verifiable-answers | **Date**: 2026-10-29 | **Implementatie**:
`src/components/chat/AnswerMeta.tsx`, `src/components/chat/MessageList.tsx`,
`src/components/chat/MessageContent.tsx`, `src/lib/rag-client.ts`,
`src/components/analysis/SourcePanel.tsx`

**Servercontract ongewijzigd**: het rag-chat-response-contract v2
(`specs/011-resumable-chat-page/contracts/rag-chat.md`) en de databasevorm uit
`specs/012-per-answer-feedback/data-model.md` (migratie 017) blijven ongemoeid —
geen Edge Function-, n8n- of schemawijzigingen. Dit contract beschrijft hoe de
frontend de bestaande velden toont.

## 1. Bronknoppen en BronRef-mapping

Per afgeronden assistentbericht met `sources.length > 0` toont de chat genummerde
knoppen onder het antwoord: zichtbare tekst `[1] <documentnaam>`, `[2] <documentnaam>`,
… (1-gebaseerd, per antwoord).

| BronRef-veld | Mapping uit chatbron (`RagSource`) | Regels |
|--------------|--------------------------------------|--------|
| `id` | `'K' + (index + 1)` | `^[KRA][0-9]+$` (K = kennisbron); gelijk aan knopnummer |
| `document` | `title ?? 'Zonder titel'` | altijd niet-lege weergavenaam |
| `locatie` | `page ?? ''` | leeg zolang n8n geen locatie levert |
| `passage` | `excerpt ?? ''` | letterlijk fragment |

- `score` wordt nergens meer getoond (geen percentages bij bronnen).
- Client-schema: `RagSourceSchema`/`RagSource` (in `src/lib/rag-client.ts`) krijgen
  het optionele veld `page?: string`. Achterwaarts compatibel; zodra n8n een locatie
  in de bronnen meelevert, verschijnt die zonder frontend-wijziging in het paneel
  (zod stripte onbekende keys op het live-pad; het herlaad-pad geeft jsonb al
  ongemoeid door).

## 2. Bronpaneel (hergebruik `src/components/analysis/SourcePanel.tsx`)

- Eén instantie per chatpagina (`MessageList`), `fixed` zijpaneel, `role="dialog"`,
  `aria-label="Bronverwijzing"`; dicht = `aria-hidden` + `inert`.
- Openen: klik of toetsenbordactivatie (Enter/Space) op een bronknop; de panelstate
  verwangt bij een nieuwe bron (één paneel tegelijk).
- Sluiten: Escape (document-keydown) of de sluitknop; in beide gevallen keert de
  focus terug naar de bronknop die opende (guard: element nog in het DOM).
- Panelinhalt: Referentie (`K1`, `K2`, …), Document, Letterlijke passage — en
  Locatie uitsluitend bij een niet-lege waarde (minimale `SourcePanel`-wijziging;
  de analyse-flow gedraagt zich ongewijzigd omdat analysebronnen altijd een locatie
  hebben).
- Navigatie naar een ander gesprek sluit het paneel.

## 3. Verificatieregel

Input: `ChatMessage.verification` (`RagVerification | null | undefined`).

| Voorwaarde | Weergave |
|------------|----------|
| `verification` ontbreekt/`null` | géén verificatieregel, géén foutmelding |
| `grounded = false` óf `confidence < 0.7` | waarschuwing (Amber, `role="note"`): "Dit antwoord is niet volledig onderbouwd door de bronnen." + de lijst gevonden problemen (alleen bij `issues.length > 0`) |
| `grounded = true` én `confidence >= 0.7` | "Gecontroleerd tegen de bronnen" |

- Drempel: benoemde constante `CONFIDENCE_THRESHOLD = 0.7` (in `AnswerMeta.tsx`);
  vergelijking strikt kleiner-dan.
- Vorm van `verification` (live én jsonb): `{ grounded: boolean, confidence: number,
  issues: string[] }`; narrowing van databaserijen via `parseVerification` (zod
  `safeParse` → `null` bij ongeldig formaat).

## 4. Antwoordweergave (sanitatie)

- Assistentcontent: uitsluitend via `sanitizeMarkdown` (bestaande
  `MARKDOWN_ALLOWED_TAGS` incl. tabellen); links openen in een nieuw tabblad met
  `rel="noopener noreferrer"` (bestaande DOMPurify-hook). Opmaak van de gemaakte
  elementen (p, ul, ol, li, strong, table, th, td) via Tailwind-varianten op de
  container; géén `@tailwindcss/typography`.
- Gebruikerscontent: letterlijke platte tekst (React-escaping), regeleinden via
  `whitespace-pre-wrap`; géén HTML- of markdown-interpretatie.
- CONCEPT-label: op elk afgeronden assistentbericht, formulering conform de
  bestaande app-conventie "CONCEPT, door adviseur te accorderen".
- Alle nieuwe UI-teksten: Nederlands, u-vorm, zonder aanbevelende formuleringen
  (constitution I + II).