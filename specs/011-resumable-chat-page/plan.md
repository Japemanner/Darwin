# Implementation Plan: Chat als eigen pagina met hervatbare gesprekken

**Branch**: `011-resumable-chat-page` | **Date**: 2026-10-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/011-resumable-chat-page/spec.md` + de technische route uit de `/speckit.plan`-opdracht (routes, rag-chat-uitbreiding, frontend, voorbeeldvragen, tests)

## Summary

De chat verhuist van het 480px-zijpaneel (`ChatWindow` in `AssistantsPage.tsx`) naar een
eigen pagina met eigen adres: `/chat/new/:assistantId` voor een nieuw gesprek en
`/chat/:conversationId` voor een bestaand gesprek (uitsluitend id's, constitution III).
De Edge Function `rag-chat` wordt uitgebreid tot het enige opslagpunt: de client stuurt
een zelfgegenereerd `message_id`, de server controleert eigendom, maakt (indien nodig)
het gesprek aan met de titel uit de eerste vraag (getrimd, max 80 tekens + '…'), slaat
vraag en antwoord server-side op en retourneert het volledige resultaat. Hierdoor is een
gesprek herlaadbaar, hervatbaar en idempotent herstelbaar ("Opnieuw proberen" met
hetzelfde `message_id` maakt geen dubbel bericht). De frontend krijgt een meerregelig
invoerveld (Enter verstuurt, Shift+Enter nieuwe regel), een inline foutmelding bij de
vraag met "Opnieuw proberen", een kopieerknop per antwoord, de bestaande
gespreksbrede feedbackbalk (ongewijzigd verplaatst), een wachtmelding na 15 seconden
en voorbeeldvragen (max 4, beheerder instelt via `ai_assistants.example_questions`).

## Technical Context

**Language/Version**: TypeScript 5 / React 18 / Vite 6; Deno (Edge Function); PostgreSQL 15 (Supabase)

**Primary Dependencies**: react-router-dom v6, TanStack Query v5 (`src/hooks/queries.ts`), `@supabase/supabase-js` v2, zod (`src/lib/rag-client.ts`), Tailwind CSS + shadcn/ui, lucide-react, Playwright (e2e) — geen nieuwe npm-dependencies

**Storage**: Supabase PostgreSQL met RLS; tabellen `ai_assistants` (+nieuwe kolom `example_questions text[]`), `conversations`, `messages` — schrijfacties (gesprek, berichten) verhuizen van de browser naar de Edge Function (service role na eigendomscontrole)

**Testing**: Playwright (`tests/e2e/`, Supabase-REST en rag-chat gemocked via `page.route`, login via echte PKCE-sessie per `fixtures.ts`) — nieuw `chat-page.spec.ts` (4 gevallen uit de route), herwerkt `rag-chat.spec.ts`, kleine update `admin-only-management.spec.ts`; persistentie na herladen handmatig geverifieerd tegen de echte Edge Function volgens [quickstart.md](quickstart.md)

**Target Platform**: Web (Netlify) + Supabase platform (Auth, Database, Edge Functions)

**Project Type**: web-app

**Performance Goals**: geen nieuwe harde prestatie-eisen; wachtmelding na 15 s (FR-018); edge-time-out blijft 60 s (bestaand); paginaroutering zonder herlaad-flicker (navigate replace)

**Constraints**: geen klantinhoud in URL's/console/logs/PostHog/browseropslag (constitution III); WCAG 2.1 AA incl. focusreturn naar het invoerveld (constitution IV); typed client + geen stille fouten (constitution V); RLS op elke tabel; PKCE; UI-tekst Nederlands in u-vorm (constitution I); alleen bestanden die deze spec nodig heeft

**Scale/Scope**: 2 routes, 1 nieuwe pagina + 5 nieuwe chatcomponenten, 1 SQL-migratie, 1 Edge Function-uitbreiding, 1 typed client-update, 1 nieuw e2e-spec + 2 bijgewerkte e2e-specs, ~7 bestaande bestanden licht gewijzigd

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Status | Toelichting |
|---|------|--------|-------------|
| 1 | Dutch UI copy, u-vorm (Principle I) | PASS met noot | Alle nieuwe teksten in u-vorm: "Typ uw bericht…", "Opnieuw proberen", "Antwoord wordt opgesteld…", "Dit duurt langer dan gebruikelijk.", "Gekopieerd", "Nieuw gesprek", "Gesprek niet gevonden". De verplaatste feedbackbalk houdt haar bestaande je-vorm-teksten **ongewijzigd** (expliciete opdracht "ongewijzigd"; feedback wordt per spec in een latere feature vervangen). |
| 2 | Concept, never advice (Principle II) | PASS | Antwoordweergave (markdown, bronnen, CONCEPT-label) is expliciet buiten scope; geen nieuwe output-weergave of advies-taal. |
| 3 | Client data sensitivity (Principle III) | PASS | Adressen bevatten uitsluitend id's: `/chat/new/:assistantId`, `/chat/:conversationId` (uuid's). Edge-log blijft code + id's + duur (`logCode`-patroon; `message_id` is een id). Berichtinhoud blijft buiten URL's, console, PostHog en browseropslag (React-state only; retry bewaart `message_id` in component-state, niet in storage). n8n-payload ongewijzigd. |
| 4 | Accessibility WCAG 2.1 AA (Principle IV) | PASS | Alle nieuwe besturing is native `button`/`textarea`/`link` met bestaande focus-states; Enter/Shift+Enter afgevangen zonder muishandler; focus keert na versturen terug naar het invoerveld (FR-007); fout + "Opnieuw proberen" volledig toetsenbordbedienbaar; wachtmelding krijgt `aria-live="polite"`; niet-gevonden-states zijn semantische headings met terugkeerlink (FR-011, FR-019). |
| 5 | Typed external clients, no silent failures (Principle V) | PASS | `rag-client.ts` krijgt nieuwe zod-schema's voor request én response (v2-contract); foutcodes ongewijzigd; klembordfout → zichtbare toast; gesprek niet laden → "Gesprek niet gevonden" in plaats van een lege pagina; geen enkele fout verdwijnt stil. |
| 6 | Minimal scope (Principle VI) | PASS | Geen nieuwe npm-dependencies; componenten exact zoals de route voorschrijft (ChatHeader, MessageList, MessageBubble, ChatComposer, ChatEmptyState) hergebruiken bestaande `MessageContent`; geen nav-wijziging (chat heeft geen nav-item nodig; `pathname.startsWith` matcht `/chat/*` op geen item); de legacy-requestpath in de Edge Function is een beperkte deploy-continuïteitsmaatregel (research #4), geen speculatieve functionaliteit. |

**Re-check na Phase 1 (design): PASS** — het ontwerp voegt twee verfijningen op de route toe die beide noodzakelijk zijn voor correctheid: (a) `message_id`-first gespreksresolutie (voorkomt dubbele gesprekken bij "Opnieuw proberen" na een mislukte eerste vraag, research #2) en (b) een legacy-requestpath zonder `message_id` die de huidige productieclient tijdens de rollout ongemoeid laat (research #4). Geen van beide vergroot de scope; beide zijn gedocumenteerd in [contracts/rag-chat.md](contracts/rag-chat.md).

## Project Structure

### Documentation (this feature)

```text
specs/011-resumable-chat-page/
├── plan.md              # Dit bestand
├── research.md          # Phase 0: onderzoeksbeslissingen (routes, retry-pad, rollout, UX-details)
├── data-model.md        # Phase 1: entiteiten, migratie, UI-state transitions
├── quickstart.md        # Phase 1: rolloutvolgorde en handmatige persistentie-verificatie
├── contracts/
│   └── rag-chat.md      # Phase 1: v2-contract (supersedeert 009/contracts/rag-chat.md)
├── checklists/
│   └── requirements.md  # Spec-quality-checklist (uit /speckit.specify)
└── tasks.md             # /speckit.tasks (nog niet aangemaakt)
```

### Source Code (repository root)

```text
supabase/
├── migrations/
│   └── 016_assistant_example_questions.sql   # NIEUW: ai_assistants.example_questions text[] NOT NULL DEFAULT '{}'
└── functions/
    └── rag-chat/
        └── index.ts                           # UITGEBREID: message_id, conversation-create (titel = eerste
                                               # vraag), berichtopslag via service role na eigendomscontrole,
                                               # nieuwe response; legacy-path zonder message_id (rollout)

src/
├── App.tsx                                   # +2 lazy routes binnen AppShell: /chat/new/:assistantId, /chat/:conversationId
├── pages/
│   ├── AssistantsPage.tsx                    # ChatWindow verwijderd; "Chat"-knop → navigate(/chat/new/:id);
│   │                                         # AssistantModal: textarea "Voorbeeldvragen (één per regel, maximaal 4)"
│   └── ChatPage.tsx                          # NIEUW: route-modi (nieuw/bestaand), send/retry-flow, feedbackbalk
│                                             # (ongewijzigd verplaatst), 15s-wachtmelding, focusbeheer
├── components/
│   └── chat/
│       ├── ChatHeader.tsx                    # NIEUW: icoon/naam/omschrijving + "Nieuw gesprek"
│       ├── ChatEmptyState.tsx                # NIEUW: omschrijving + voorbeeldvragen als knoppen (max 4)
│       ├── ChatComposer.tsx                  # NIEUW: textarea, auto-grow tot 8 regels, Enter/Shift+Enter
│       ├── MessageList.tsx                   # NIEUW: scrollcontainer, auto-scroll, wachtmelding (aria-live)
│       ├── MessageBubble.tsx                 # NIEUW: gebruikt bestaande MessageContent; bronnen-toggle,
│       │                                     # kopieerknop, foutblok + "Opnieuw proberen"
│       └── MessageContent.tsx                # ONGEWIJZIGD
├── hooks/
│   └── queries.ts                            # + useAssistant, useConversation; example_questions in
│                                             # useCreateAssistant/useUpdateAssistant-payloads
├── lib/
│   └── rag-client.ts                         # v2: message_id in request, conversation_id optioneel,
│                                             # nieuwe response-schema's (assistant_message genest)
└── types/
    └── database.types.ts                      # example_questions: string[] (Row/Insert/Update)

tests/
└── e2e/
    ├── chat-page.spec.ts                     # NIEUW: URL /chat/<uuid>, Shift+Enter, fout→retry→één
    │                                         # gebruikersbericht, voorbeeldvraag-klik (route-item 5)
    ├── rag-chat.spec.ts                      # HERWERKT: sidebar-flow → pagina-flow; toasts → inline
    │                                         # fout + retry; request/response-contract v2
    └── admin-only-management.spec.ts         # KLEINE UPDATE: "can still start a chat" — knop navigeert
                                              # naar /chat/new/:id (composer zichtbaar i.p.v. sidebar)
```

**Structure Decision**: Volgt de bestaande web-app-structuur (pagina's in `src/pages/`,
chatcomponenten in `src/components/chat/` naast het bestaande `MessageContent.tsx`,
queries geconcentreerd in `src/hooks/queries.ts`, typed client in `src/lib/`). De twee
routes zijn ondiepte-ongelijk (`/chat/new/:id` = 3 segmenten, `/chat/:conversationId` =
2 segmenten) waardoor react-router-dom v6 ze zonder conflict rangschikt; `/chat/new`
zonder id valt terug op het bestaande gesprek "new" → niet gevonden → "Gesprek niet
gevonden" (graceful, research #1). De feedbackbalk blijft inline in `ChatPage.tsx`
("ongewijzigd verplaatst"; de route noemt geen apart feedbackcomponent).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

Geen violations — alle gates PASS. De twee genoteerde afwijkingen (bestaande
je-vorm-tekst in de verplaatste feedbackbalk; legacy-requestpath in de Edge Function)
zijn geen scope-overschrijdingen maar respectievelijk een expliciete opdracht uit de
technische route en een beperkte deploy-continuïteitsmaatregel; beide zijn verantwoord
in de gatetabel en research (#1, #4) en markeren geen extra complexiteit die een
simpeler alternatief nodig had.