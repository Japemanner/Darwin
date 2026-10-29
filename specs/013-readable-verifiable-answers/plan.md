# Implementation Plan: Antwoorden leesbaar, controleerbaar en als CONCEPT gemarkeerd

**Branch**: `013-readable-verifiable-answers` | **Date**: 2026-10-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/013-readable-verifiable-answers/spec.md` + de
technische route uit de `/speckit.plan`-opdracht (MessageContent role-prop, AnswerMeta,
SourcePanel-hergebruik, score-badge/uitklaplijst weg, zes gemockte Playwright-gevallen)

## Summary

Chatantwoorden worden leesbaar, controleerbaar en constitutioneel gemarkeerd — volledig
frontend, zonder migraties, Edge Function- of dependency-wijzigingen. `MessageContent`
krijgt een `role`-prop: assistentantwoorden renderen via de bestaande `sanitizeMarkdown`
(alinea's, opsommingen, vet, tabellen; links krijgen via de bestaande DOMPurify-hook
`target="_blank" rel="noopener noreferrer"`), gebruikersvragen worden letterlijke platte
tekst met behoud van regeleinden — geen HTML-interpretatie meer. Nieuw `AnswerMeta`
onder elk assistentbericht: de CONCEPT-badge (bestaande formulering "CONCEPT, door
adviseur te accorderen"), de verificatieregel op basis van `message.verification`
(waarschuwing met gevonden problemen bij `grounded = false` óf `confidence < 0,7` met
de drempel als benoemde constante; "Gecontroleerd tegen de bronnen" bij een onderbouwd
antwoord; niets bij ontbrekende verificatiegegevens) en de bronnen als genummerde
knoppen `[1]`, `[2]` met documentnaam. De chat hergebruikt het bestaande `SourcePanel`
als zijpaneel: chatbronnen worden gemapt naar `BronRef` (`id = 'K' + (index + 1)`,
`document = title`, `locatie = page ?? ''`, `passage = excerpt`) met één minimale
SourcePanel-aanpassing (Locatie verborgen bij lege waarde); Escape en focusterugkeer
draaien in de chat zelf (`MessageList`), de analyse-flow blijft verder onaangeroerd.
De score-badge en uitklaplijst verdwijnen uit de chatweergave. `ChatPage` draagt de
verificatiegegevens mee (live antwoord én seeding uit de gepersisteerde jsonb-kolom,
met typen narrowing via `parseVerification`), en `rag-client` krijgt een optioneel
`page`-veld bij bronnen plus de geëxporteerde `parseVerification`. E2E: nieuw
`answer-presentation.spec.ts` (volledig gemocked) met de zes route-gevallen plus de
letterlijke vraag en het herlaad-pad, en de verouderde bron-assertie in
`rag-chat.spec.ts` wordt meegevoerd naar de nieuwe UI.

## Technical Context

**Language/Version**: TypeScript 5 / React 18 / Vite 6 — frontend-only

**Primary Dependencies**: bestaand — `marked` v18 + `dompurify` v3 (`src/lib/sanitize.ts`:
`sanitizeMarkdown` met `p`, `ul`, `ol`, `li`, `strong`, `table`, `thead`, `tbody`, `tr`,
`th`, `td` in `MARKDOWN_ALLOWED_TAGS`; bestaande hook zet `target="_blank"`
`rel="noopener noreferrer"` op elk `<a>`), `zod` v3 (verificatie-narrowing, bronschema),
Tailwind CSS v3 + shadcn/ui (Badge, Button), `lucide-react`, Playwright — **geen nieuwe
npm-dependencies** (research #11)

**Storage**: N/A — geen database-, Edge Function- of migratiewijzigingen. Gelezen data:
bestaande `messages.verification` (jsonb, `{ grounded, confidence, issues }`, migratie
017) en `messages.sources` (jsonb, `{ knowledge_item_id?, title?, excerpt?, score?,
page? }`); niets wordt nieuw weggeschreven

**Testing**: Playwright (`tests/e2e/`) — nieuw `answer-presentation.spec.ts`, volledig
gemocked volgens het `rag-chat.spec.ts`-patroon (`page.route` op REST + edge function):
markdown-lijst rendert als lijst, CONCEPT-label aanwezig, waarschuwing bij
`grounded = false` (plus `confidence < 0,7`), bronknop → paneel → Escape →
focusterugkeer, géén `%` bij bronnen, XSS-poging niet uitgevoerd, letterlijke vraag
(US5) en herlaad-pad met én zonder verificatiegegevens (FR-007). Bestaande
`rag-chat.spec.ts`-bronassertie (regel 156-159, oude UI) aangepast naar de nieuwe UI;
overige specs ongewijzigd geldig (research #9)

**Target Platform**: Web (Netlify) — frontend-only release via develop → main

**Project Type**: web-app

**Performance Goals**: markdown-rendering per bericht via `useMemo` (bestaand patroon
`MessageContent.tsx:9`); één panelinstantie ongeacht het aantal antwoorden (research #6);
geen nieuwe harde prestatie-eisen

**Constraints**: geen klantinhoud in URL's, console, logs, PostHog of browseropslag
(constitution III — geen nieuwe opslag of telemetrie); WCAG 2.1 AA: toetsenbord openen,
Escape sluiten, focusterugkeer, focus-states, contrast (constitution IV); UI Nederlands
in u-vorm, code/identifiers/commits Engels (constitution I); geen aanbevelende
formuleringen (constitution II); alleen route-genoemde bestanden, geen refactors ernaast;
klaar = `tsc --noEmit`, `eslint --max-warnings 0`, `npm run build` en de
Playwright-tests van deze feature groen

**Scale/Scope**: 2 nieuwe bestanden (`AnswerMeta.tsx`, `answer-presentation.spec.ts`);
~8 licht gewijzigd (`MessageContent.tsx`, `MessageBubble.tsx`, `MessageList.tsx`,
`ChatPage.tsx`, `rag-client.ts`, `SourcePanel.tsx`, `rag-chat.spec.ts`, `AGENTS.md`
context-verwijzing)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Status | Toelichting |
|---|------|--------|-------------|
| 1 | Dutch UI copy, u-vorm (Principle I) | PASS | Alle nieuwe teksten Nederlands en feitelijk: "CONCEPT, door adviseur te accorderen" (bestaande app-conventie), "Gecontroleerd tegen de bronnen", waarschuwing "Dit antwoord is niet volledig onderbouwd door de bronnen." met "Gevonden problemen:", bronknoppen `[1] <documentnaam>`, paneelteksten bestaan al. Code, identifiers en commits Engels. |
| 2 | Concept, never advice (Principle II) | PASS | Elke afgeronde antwoord krijgt voortaan zichtbaar het CONCEPT-label (sluit de bestaande constitution-gap). Alle nieuwe teksten zijn beschrijvend; geen aanbevelende of adviserende formuleringen; de waarschuwing benoemt vastgestelde problemen zonder handelingsadvies. |
| 3 | Client data sensitivity (Principle III) | PASS | Alleen weergave van data die al in de sessie/berichtgegevens zit; niets nieuw in URL's, console, logs, PostHog of browseropslag; geen nieuwe externe calls. E2E gebruikt synthetische teksten ("Personeelshandboek", E2E-fixtures), geen klantinhoud. |
| 4 | Accessibility WCAG 2.1 AA (Principle IV) | PASS | Bronknoppen zijn native `<button>` (toetsenbord + focus-states); het paneel heeft `role="dialog"` + `aria-label` en is dicht `aria-hidden`/`inert`; Escape sluit (document-keydown, bestaand `ui/dialog.tsx`-patroon) en de focus keert terug naar de bronknop (FR-010); waarschuwing als zichtbaar tekstblok met `role="note"` (amber-patroon uit `ResultView`, AA-contrast); CONCEPT-badge is tekst. |
| 5 | Typed external clients, no silent failures (Principle V) | PASS | Geen nieuwe externe client. Verificatie-narrowing via geëxporteerd zod-schema (`parseVerification`): ongeldig formaat → `null` → géén regel én géén foutmelding, exact het gespecificeerde gedrag (FR-007, geen geslikte runtime-fout); bronnen smalnarrowen via het getypeerde `RagSource`. |
| 6 | Minimal scope (Principle VI) | PASS | Geen nieuwe dependencies (`@tailwindcss/typography` expliciet níét, research #2); `SourcePanel` krijgt alleen het Locatie-conditional (route-instructie); Escape/focusterugkeer zit in de chat, niet in de gedeelde component (research #5); bestaande tests alleen aangepast waar de UI die zij asserten bewust vervalt (`rag-chat.spec.ts:156-159`); geen wijzigingen aan n8n, analyse-flow of Geschiedenis-pagina. |

**Re-check na Phase 1 (design): PASS** — het ontwerp voegt twee noodzakelijke verbredingen
aan de route toe, beide gedocumenteerd in [research.md](research.md): (a) een optioneel
`page`-veld in het client-bronschema, anders filtert de zod-parse op het live-pad precies
de waarde weg die de route-voorschrift (`locatie = page ?? ''`, research #4); (b) een
geëxporteerde `parseVerification` voor het herlaad-pad, anders is de jsonb-kolom
`Record<string, unknown>` niet veilig te tonen (research #3). Beide zijn 2-regelige
frontendwijzigingen binnen de genoemde bestanden — geen scope-uitbreiding.

## Project Structure

### Documentation (this feature)

```text
specs/013-readable-verifiable-answers/
├── plan.md                  # Dit bestand
├── research.md              # Phase 0: 11 onderzoeksbeslissingen (sanitatie, styling,
│                            #   verificatie-draden, BronRef-mapping, panelstate, tests)
├── data-model.md            # Phase 1: entiteiten, mapping, validatieregels, paneltransities
├── quickstart.md            # Phase 1: lokale checks, handmatige verificatie, release
├── contracts/
│   └── chat-source-display.md  # Phase 1: bronmapping-, paneel- en verificatieweergave-contract
├── checklists/
│   └── requirements.md      # Spec-quality-checklist (uit /speckit.specify)
└── tasks.md                 # /speckit.tasks (nog niet aangemaakt)
```

### Source Code (repository root)

```text
src/
├── components/chat/
│   ├── AnswerMeta.tsx                  # NIEUW: CONCEPT-badge, verificatieregel
│   │                                   #   (CONFIDENCE_THRESHOLD = 0.7), bronknoppen
│   │                                   #   [n] + documentnaam, BronRef-mapping
│   ├── MessageContent.tsx              # role-prop: assistent → sanitizeMarkdown +
│   │                                   #   Tailwind-containerstijl; gebruiker → letterlijke
│   │                                   #   platte tekst (geen HTML)
│   ├── MessageBubble.tsx               # ChatMessage +verification; lokale Source-interfaces,
│   │                                   #   score-badge en uitklaplijst verwijderd; AnswerMeta
│   │                                   #   onder elk assistentbericht; role doorgeven;
│   │                                   #   onOpenBron-prop
│   └── MessageList.tsx                 # bronpaneelstate (één instantie), Escape-handler +
│                                       #   focusterugkeer, SourcePanel-render, sluiten bij
│                                       #   gesprekwissel; onOpenBron naar MessageBubble
├── components/analysis/
│   └── SourcePanel.tsx                 # MINIMAAL: Locatie-blok verborgen bij lege waarde
├── pages/
│   └── ChatPage.tsx                    # verification meedragen: live antwoord
│                                       #   (result.verification) + seeding
│                                       #   (parseVerification(m.verification))
└── lib/
    └── rag-client.ts                   # +optioneel page in RagSourceSchema/RagSource;
                                        #   +geëxporteerde RagVerificationSchema-narrowing
                                        #   parseVerification(value: unknown)

tests/e2e/
├── answer-presentation.spec.ts         # NIEUW: markdown, CONCEPT, waarschuwing, bronpaneel
│                                       #   (Escape + focus), geen %, XSS, letterlijke vraag,
│                                       #   herlaad-pad — alles gemocked
└── rag-chat.spec.ts                    # bronassertie (regel 156-159) naar nieuwe UI
```

**Structure Decision**: bestaande structuur ongewijzigd — de app heeft één
`src/`-frontend met chat- en analysis-componenten; de feature voegt één chat-component
toe en hergebruikt het analysis-`SourcePanel` (minimale aanpassing, research #5).
Geen nieuwe mappen, modules of projecten.

## Complexity Tracking

> Geen constitution-schendingen om te rechtvaardigen — tabel blijft leeg. De twee
> route-verbredingen uit de Constitution re-check zijn correctheidsherstel binnen
> de genoemde bestanden (research #3, #4), geen complexiteit boven de constitution.