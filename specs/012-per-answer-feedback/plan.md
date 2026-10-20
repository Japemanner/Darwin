# Implementation Plan: Feedback per antwoord, en vastleggen hoe een antwoord tot stand kwam

**Branch**: `012-per-answer-feedback` | **Date**: 2026-10-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/012-per-answer-feedback/spec.md` + de
technische route uit de `/speckit.plan`-opdracht (migratie, Edge Function, frontend, tests)

## Summary

Feedback verhuist van het hele gesprek naar het individuele antwoord. Migratie **017**
voegt `rewritten_query`, `verification` (jsonb) en `latency_ms` toe aan `messages` en
breidt `feedback_interactions` uit met `message_id` (FK, ON DELETE CASCADE), `reason`
(CHECK met de vijf redencodes) en `updated_at` (trigger). De constraint
één-oordeel-per-gesprek vervalt; uniekheid komt op `(message_id, user_id)` te liggen —
als **volledige** unieke index (partieel is niet targetbaar door de REST-upsert,
research #1). De INSERT-policy wordt vervangen en een UPDATE-policy toegevoegd, beide
"bericht moet in een gesprek van `auth.uid()` zitten" — afgedwongen via de bestaande
`messages`-RLS. De Edge Function `rag-chat` slaat bij het assistentbericht de
herschreven zoekvraag, de verificatie (`{grounded, confidence, issues}`) en de
doorlooptijd op (die n8n al meelevert en die nu verloren gaan). Frontend: nieuw
`AnswerFeedback`-component onder elk afgeronden assistentbericht (duim omhoog =
directe upsert; duim omlaag = radiogroep met reden + optionele toelichting,
"Versturen"/"Annuleren"; `aria-pressed` + NL labels), één query per gesprek
(`useMessageFeedback`) en één upsert-mutatie die bij wijziging het oude oordeel
volledig overschrijft. De gespreksbrede balk en `useFeedbackInteraction` verdwijnen;
bestaande gespreksfeedback blijft in de database bewaard (FR-009). Beheerders krijgen
`get_feedback_review()`: een `SECURITY DEFINER`-functie met vaste `search_path` die alle
negatieve oordelen van de eigen organisatie teruggeeft met vraag, antwoord, verificatie,
herschreven zoekvraag, responstijd, assistent en datum — geen UI (buiten scope).
E2E: nieuw spec met echte Supabase-seeding via het testaccount (route-opdracht) voor de
vier route-scenario's, met cascade-cleanup.

## Technical Context

**Language/Version**: TypeScript 5 / React 18 / Vite 6; Deno (Edge Function); PostgreSQL 15 (Supabase)

**Primary Dependencies**: `@supabase/supabase-js` v2 (client én test-seeding — bestaande productie-dependency), TanStack Query v5 (`src/hooks/queries.ts`), react-router-dom v6, Tailwind CSS + shadcn/ui (button, label, textarea, toast — bestaand), lucide-react (ThumbsUp/ThumbsDown), Playwright (e2e) — **geen nieuwe npm-dependencies**

**Storage**: Supabase PostgreSQL met RLS — migratie 017: `messages` +3 nullable kolommen; `feedback_interactions` +`message_id`/`reason`/`updated_at`, −constraint één-per-gesprek, +unieke index `(message_id, user_id)`, +INSERT/UPDATE-policies, +`set_updated_at`-trigger, +functie `get_feedback_review()` (SECURITY DEFINER, `SET search_path = public`); Edge Function schrijft antwoordgegevens service-role bij het assistentbericht

**Testing**: Playwright (`tests/e2e/`) — nieuw `answer-feedback.spec.ts` met seeding via de Supabase-client van het testaccount (`process.loadEnvFile` + `signInWithPassword`, cleanup via gespreks-delete cascade, research #12): duim omhoog per antwoord, duim omlaag met reden zonder toelichting, oordeel wijzigen, oordeel na herladen. Bestaande specs blijven ongewijzigd (mocks blijven geldig, research #12). Database-/functieverificatie handmatig per [quickstart.md](quickstart.md) (SQL-blokken) + Supabase MCP (F-01 RLS)

**Target Platform**: Web (Netlify) + Supabase platform (Auth, Database, Edge Functions)

**Project Type**: web-app

**Performance Goals**: één feedbackquery per gesprek (react-query-dedupliceert alle AnswerFeedback-instanties naar één request); upsert in één round-trip; geen nieuwe harde prestatie-eisen; `get_feedback_review()` is een STABLE-SQL-select zonder sequentiële scans (index op `message_id`, PK-lookups)

**Constraints**: geen klantinhoud in URL's, console, logs, PostHog of browseropslag (constitution III); WCAG 2.1 AA: `aria-pressed`, native controls, zichtbare focus (constitution IV); geen stille fouten — NL toast bij opslagfout (constitution V); UI Nederlands in u-vorm, code/identifiers/commits Engels (constitution I); alleen bestanden die deze spec nodig heeft; geen nieuwe dependencies; klaar = `tsc --noEmit`, `eslint --max-warnings 0`, `npm run build` en de Playwright-tests van deze feature groen

**Scale/Scope**: 1 SQL-migratie (017), 1 Edge Function-uitbreiding (3 velden bij bestaande insert), 1 nieuw component + 2 hooks (1 query + 1 mutatie), ChatPage-balkverwijdering, `database.types.ts`, 1 nieuw e2e-spec; 4 nieuwe bestanden, ~6 bestaande licht gewijzigd

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Status | Toelichting |
|---|------|--------|-------------|
| 1 | Dutch UI copy, u-vorm (Principle I) | PASS | Alle nieuwe teksten in u-vorm: "Antwoord is nuttig", "Antwoord is niet nuttig", "Wat ging er mis?", redenen (Onjuist, Onvolledig, Bron klopt niet, Vraag niet begrepen, Anders), "Toelichting (optioneel)", "Versturen", "Annuleren", fout-toast "Kon uw beoordeling niet opslaan. Probeer het opnieuw." De je-vorm-teksten uit de oude balk ("Bedankt voor je feedback!") verdwijnen mee met de balk — de uitzondering uit plan 011 vervalt. |
| 2 | Concept, never advice (Principle II) | PASS | Antwoordweergave, bronnen en CONCEPT-label ongewijzigd; de feedback-UI bevat geen gegenereerde output en geen aanbevelende formuleringen. |
| 3 | Client data sensitivity (Principle III) | PASS | Geen URL-wijzigingen (`/chat/:id` blijft id-only). Upsert-payload bevat uitsluitend id's, boolean, redencode en de door de adviseur zelf getypte toelichting — die gaat alleen naar de eigen feedback-tabel (het doel van de feature), nooit naar console/PostHog/logs. Edge-log blijft code + id's + duur (bestaand `logCode`-patroon). `get_feedback_review()` retourneert vraag-/antwoordtekst, maar alleen via de geauthenticeerde RPC aan beheerders van de eigen organisatie — niet in URL's, logs of analytics. E2E-seeding gebruikt testteksten ("E2E …"), geen echte klantinhoud. |
| 4 | Accessibility WCAG 2.1 AA (Principle IV) | PASS | Duimknoppen: native `<button>` met `aria-pressed` en NL toegankelijk label; redenkeuze: native radios in `<fieldset>` met `<legend>`, `<Label>`-koppeling; textarea en knoppen bestaan al (shadcn); alles toetsenbordbedienbaar met bestaande focus-states; "Versturen" disabled zonder reden (FR-012, acceptatiecriterium aria-pressed). |
| 5 | Typed external clients, no silent failures (Principle V) | PASS | Eén upsert via `@supabase/supabase-js` met bijgewerkt `database.types.ts` (kolommen + `get_feedback_review`-Returntype); fout → NL toast, component blijft bruikbaar (FR-008); query-fouten via react-query error-state zonder stil verdwijnen; RPC-typen in `database.types.ts`. Geen nieuwe externe client. |
| 6 | Minimal scope (Principle VI) | PASS | Geen nieuwe dependencies (native radios i.p.v. radix-radio, research #11); geen beheer-UI (functie is bewust zonder scherm, route-eis); alleen route-genoemde bestanden; `useFeedbackInteraction` verdwijnt omdat geen consument overblijft. Twee bewuste afwijkingen van de route-tekst zijn correctheidsherstel, geen scope-uitbreiding: de **volledige** unieke index i.p.v. partieel (onmisbaar voor de door de route zelf gevraagde REST-upsert, research #1) en `latency_ms` in de functie-output (FR-011 noemt de responstijd expliciet, research #4). |

**Re-check na Phase 1 (design): PASS** — het ontwerp voegt noodzakelijke correctheden
aan de route toe, allen gedocumenteerd in [research.md](research.md): (a) de unieke
index is volledig i.p.v. partieel, anders faalt de PostgREST-upsert met 42P10 (#1);
(b) de oude constraint één-per-gesprek vervalt, anders is het tweede antwoord niet
beoordeelbaar (#2); (c) de INSERT-policy wordt vervangen i.p.v. uitgebreid —
permissive-OR zou de nieuwe eis niet-afdwingbaar laten (#3), met een gedocumenteerd
breekraam tijdens de rollout (#13, quickstart §3). Geen van deze vergroot de scope.

## Project Structure

### Documentation (this feature)

```text
specs/012-per-answer-feedback/
├── plan.md                  # Dit bestand
├── research.md              # Phase 0: 14 onderzoeksbeslissingen (index, policies, functie, seeding, rollout)
├── data-model.md            # Phase 1: migratie 017, entiteiten, upsert-semantiek, UI-states, SQL-verificatie
├── contracts/
│   └── feedback-db.md       # Phase 1: REST-upsert- en get_feedback_review()-contract
├── quickstart.md            # Phase 1: releasevolgorde, handmatige verificatie, rollback
├── checklists/
│   └── requirements.md     # Spec-quality-checklist (uit /speckit.specify)
└── tasks.md                # /speckit.tasks (nog niet aangemaakt)
```

### Source Code (repository root)

```text
supabase/
├── migrations/
│   └── 017_per_answer_feedback.sql          # NIEUW: messages +3 kolommen; feedback_interactions
│                                            # +message_id/reason/updated_at, −constraint één-per-gesprek,
│                                            # +unieke index (message_id,user_id), +INSERT/UPDATE-policies,
│                                            # +set_updated_at-trigger, +get_feedback_review()
└── functions/
    └── rag-chat/
        └── index.ts                          # UITGEBREID: rewritten_query, verification, latency_ms
                                               # bij de assistentbericht-insert (v2-pad; v1 ongewijzigd)

src/
├── components/chat/
│   ├── AnswerFeedback.tsx                   # NIEUW: duim omhoog/omlaag per antwoord, reden-radiogroep,
│   │                                        #   optionele toelichting, Versturen/Annuleren, aria-pressed
│   ├── MessageBubble.tsx                    # MONTAGE: AnswerFeedback onder elk sent-assistentbericht
│   │                                        #   (+2 props: conversationId, assistantId)
│   └── MessageList.tsx                      # props-doorgeef van ChatPage naar MessageBubble
├── pages/
│   └── ChatPage.tsx                         # gespreksbrede feedbackbalk verwijderd (state, handlers,
│                                            #   UI, useFeedbackInteraction); conversation-id bijhouden
│                                            #   uit laatste antwoordresultaat (navigatie-gat, research #8)
├── hooks/
│   └── queries.ts                           # +useMessageFeedback (één query per gesprek),
│                                            # +useUpsertMessageFeedback (volledige overschrijving),
│                                            # −useFeedbackInteraction (geen consumenten meer)
└── types/
    └── database.types.ts                    # messages- en feedback_interactions-kolommen,
                                               # message_id-FK-relatie, get_feedback_review-typen

tests/e2e/
└── answer-feedback.spec.ts                  # NIEUW: seeding via Supabase-client van het testaccount
                                               # (loadEnvFile, signInWithPassword, cascade-cleanup);
                                               # 4 scenario's: omhoog per antwoord, omlaag met reden
                                               # zonder toelichting, wijzigen, na herladen
```

**Structure Decision**: volgt de bestaande web-app-structuur uit 011 — chatcomponenten
in `src/components/chat/` (MessageBubble is het montatiepunt, dicht bij de
berichtcontext), queries en mutaties geconcentreerd in `src/hooks/queries.ts`,
typen in het handmatig onderhouden `src/types/database.types.ts`, migraties genummerd
in `supabase/migrations/` (017 volgt op 016). De e2e-spec wijkt bewust af van het
mock-patroon van chat-page.spec.ts: de route schrijft seeding via het testaccount voor
(database-interactie is het bewijsdoel, research #12); bestaande specs worden niet
aangeraakt.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

Geen violations — alle gates PASS. De twee genoteerde route-afwijkingen (volledige
unieke index; `latency_ms` in de functie-output) zijn respectievelijk een harde
technische vereiste van de door de route zelf gevraagde REST-upsert en een
spec-conforme aanvulling van één kolom; beide staan in de gatetabel (nr. 6), research
(#1, #4) en worden bij de afronding aan de opdrachtgever gemeld. De
`get_feedback_review()`-functie is de enige nieuwe code buiten de route-componenten en
is zelf route-opdracht (geen alternatief nodig — een view is door RLS onbruikbaar,
research #4).