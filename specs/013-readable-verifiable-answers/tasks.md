# Tasks: Antwoorden leesbaar, controleerbaar en als CONCEPT gemarkeerd

**Input**: Design documents from `/specs/013-readable-verifiable-answers/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/chat-source-display.md, quickstart.md

**Tests**: Inbegrepen — route-item 5 eist expliciet Playwright-gevallen. Allemaal **volledig gemocked** volgens het `rag-chat.spec.ts`-patroon (`page.route` op REST + edge function): geen schrijfacties naar Supabase, geen migratie- of deploy-afhankelijkheid (frontend-only feature). Zonder `E2E_EMAIL`/`E2E_PASSWORD` in `.env.local` skippen de tests met reden — zelfde gedocumenteerde staat als 011/012 (T001).

**Organization**: Taken gegroepeerd per user story (US1–US5 uit spec.md). US1–US4 zijn P1 (opmaak, CONCEPT-label, verificatieregel, bronknoppen + paneel), US5 is P2 (letterlijke vraag). US1–US4 bouwen sequentieel op gedeelde bestanden (`MessageContent.tsx`, `AnswerMeta.tsx`, `MessageBubble.tsx`); US5 sluit af op `MessageContent.tsx`. De dataconductor (`rag-client.ts`) staat in de foundational-fase.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Kan parallel (verschillende bestanden, geen afhankelijkheden)
- **[Story]**: User story uit spec.md
- Exacte bestandspaden in elke beschrijving

---

## Phase 1: Setup

**Purpose**: Geen nieuwe infrastructuur — branch, dependencies, Vite, Playwright-config en fixtures bestaan (research #11: géén nieuwe npm-dependencies). De enige voorbereiding is de e2e-omgeving.

- [x] T001 Controleer dat `.env.local` `E2E_EMAIL`/`E2E_PASSWORD` bevat (admin-testaccount uit `tests/e2e/fixtures.ts`); vul handmatig aan bij Jaap indien ontbreekt _(gecontroleerd 2026-10-29: `E2E_EMAIL`/`E2E_PASSWORD`/`E2E_MEMBER_*` ontbreken — zelfde staat als 011/012; de suite skippt dan met reden, de nieuwe spec is volledig gemocked en draait zodra het account bestaat)_. `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` bestaan al voor de app zelf.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Gedeelde datacontracten uit `src/lib/rag-client.ts` voor US3 (verificatie-narrowing) en US4 (bron-`page`) — US1 en US2 zijn hiervan onafhankelijk.

- [x] T002 [P] Werk `src/lib/rag-client.ts` bij (research #3, #4; contracts/chat-source-display.md §1+§3): (a) til de inline verificatie-zod-schema uit `RagResponseSchema` naar modulniveau `RagVerificationSchema = z.object({ grounded: z.boolean(), confidence: z.number(), issues: z.array(z.string()) })` en hergebruik die in `RagResponseSchema`; (b) exporteer `parseVerification(value: unknown): RagVerification | null` — `RagVerificationSchema.safeParse(value)`: succes → de getypeerde waarde, anders `null` (spec edge case: ongeldig formaat → géén verificatieregel, géén foutmelding; geen stille runtime-fout, constitution V); (c) voeg aan `RagSourceSchema` `page: z.string().optional()` toe en aan interface `RagSource` `page?: string` — achterwaarts compatibel zodat een toekomstige n8n-locatie op het live-pad de zod-strip overleeft (zod stript onbekende keys). Geen gedragswijziging in `askAssistant`; respons-contract v2 blijft ongewijzigd.

**Checkpoint**: Datacontracten staan — US3/US4-mapping kan; US1/US2 kunnen onafhankelijk starten

---

## Phase 3: User Story 1 - Antwoorden met opmaak (Priority: P1) 🎯 MVP

**Goal**: Assistentantwoorden renderen via `sanitizeMarkdown` met echte opmaak — alinea's, opsommingen, vet, tabellen; links openen in een nieuw tabblad met `rel="noopener noreferrer"` (bestaande DOMPurify-hook); markdown-symbolen zijn niet langer zichtbaar.

**Independent Test**: e2e-scenario's (T003) — markdown-lijst rendert als `listitem`-elementen; vet is `<strong>`; XSS-poging wordt niet uitgevoerd.

### Tests for User Story 1

- [x] T003 [P] [US1] Maak `tests/e2e/answer-presentation.spec.ts` volgens het `rag-chat.spec.ts`-patroon (route-item 5; alles gemocked): scaffolding met `ASSISTANT`/`CONV_ROW`-constanten, `mockChatRest` (incl. `feedback_interactions` → `null`-mock), `openNewChatAndAsk`-helper en een rag-chat-route die een antwoord met markdown retourneert: `"**Kernpunten:**\n\n- Eerste punt\n- Tweede punt\n\n| Dekking | Bedrag |\n|---|---|\n| WIA | 70% |"` plus een XSS-payload `"<img src=x onerror=\"window.__xssExecuted=1\">"` in de content, met `sources: []` en `verification: { grounded: true, confidence: 0.9, issues: [] }`. Scenario's: (1) antwoord zichtbaar; `page.getByRole('listitem')` heeft exact 2 items ("Eerste punt", "Tweede punt"); `<strong>` "Kernpunten:" zichtbaar; tabelcellen "Dekking"/"WIA" zichtbaar; géén letterlijke `**`- of `|---`-symbolen in de weergave; (2) XSS: geen `img`-element in het antwoord en `window.__xssExecuted` is `undefined` na render. Verifieer FAIL vóór implementatie _(uitgevoerd 2026-10-29: geschreven en geregistreerd — 9 scenario's in het bestand; de tabel-fixture gebruikt bewust géén %-waarde zodat de US4 no-%-assertie vrij blijft; FAIL-aantonen en draaien vereisen de E2E-accounts uit T001 — de suite skippt nu met reden, 64 skipped / 0 failed)_.

### Implementation for User Story 1

- [x] T004 [US1] Voeg aan `src/components/chat/MessageContent.tsx` de prop `role: 'user' | 'assistant'` toe (route-item 1; research #1): assistenttak rendert `useMemo(() => sanitizeMarkdown(content), [content])` via `dangerouslySetInnerHTML` in een container met Tailwind-arbitrary-variants voor de gemaakte kindelementen — `[&_p]`, `[&_ul]` (list-disc + pl), `[&_ol]` (list-decimal + pl), `[&_li]`, `[&_strong]` (font-semibold), `[&_table]` (w-full + border-collapse), `[&_th]`, `[&_td]` (border + padding) — exacte classes volgens research #2; géén `@tailwindcss/typography`. Gebruikerstak blijft voorlopig op de bestaande `sanitizeHtml`-weg (interim tot US5/T021, patroon 012 T006).
- [x] T005 [US1] Geef in `src/components/chat/MessageBubble.tsx` `role={message.role}` door aan `MessageContent` (regel 56), zodat de assistenttak actief wordt voor antwoorden.

**Checkpoint**: US1 werkt zelfstandig — antwoorden tonen echte opmaak; de gebruikersweergave is (bewust) nog ongewijzigd tot US5

---

## Phase 4: User Story 2 - CONCEPT-label op elk antwoord (Priority: P1)

**Goal**: Elk afgeronden assistentbericht draagt zichtbaar het label "CONCEPT, door adviseur te accorderen" — de bestaande app-conventie (constitution II, research #7).

**Independent Test**: e2e-scenario (T006) — het CONCEPT-label is onder elk antwoord zichtbaar.

### Tests for User Story 2

- [x] T006 [US2] Voeg scenario toe aan `tests/e2e/answer-presentation.spec.ts` (zelfde scaffold, breidt T003 uit): na het antwoord is de tekst "CONCEPT, door adviseur te accorderen" zichtbaar bij het antwoord (onder de antwoordballon). Verifieer FAIL vóór implementatie.

### Implementation for User Story 2

- [x] T007 [US2] Maak `src/components/chat/AnswerMeta.tsx` (basisversie, route-item 2): een component die alleen de CONCEPT-badge rendert — shadcn `Badge` (bestaand, `@/components/ui/badge`) met de tekst "CONCEPT, door adviseur te accorderen" (onderdeel van één `AnswerMeta`-blok dat US3/US4 uitbreiden met verificatieregel en bronknoppen; basisversie zodat US2 zelfstandig testbaar is).
- [x] T008 [US2] Monteer `AnswerMeta` in `src/components/chat/MessageBubble.tsx`: binnen de berichtkolom direct onder de antwoordballon, alleen bij `!isUser` (assistentberichten bestaan uitsluitend met `status === 'sent'`; pending/failed tonen geen antwoord dus geen label — spec US2-scenario 3).

**Checkpoint**: US2 werkt zelfstandig — elk antwoord draagt het CONCEPT-label, ook na herladen (component rendert per bericht)

---

## Phase 5: User Story 3 - Onderbouwing zichtbaar per antwoord (Priority: P1)

**Goal**: Bij elk antwoord met verificatiegegevens staat precies één regel: een waarschuwing met de gevonden problemen bij `grounded = false` óf `confidence < 0,7`, of "Gecontroleerd tegen de bronnen" bij een onderbouwd antwoord; zonder verificatiegegevens géén regel en géén foutmelding — live én na herladen.

**Independent Test**: e2e-scenario's (T009) — waarschuwing bij grounded=false en bij confidence<0,7; "Gecontroleerd tegen de bronnen" bij onderbouwd; herlaad-rij mét verificatie toont de regel, zónder toont niets.

### Tests for User Story 3

- [x] T009 [US3] Voeg scenario's toe aan `tests/e2e/answer-presentation.spec.ts`: (1) rag-chat-mock met `verification: { grounded: false, confidence: 0.9, issues: ["De genoemde termijn komt niet in de bronnen voor"] }` → waarschuwing "Dit antwoord is niet volledig onderbouwd door de bronnen." zichtbaar mét de issuetekst; "Gecontroleerd tegen de bronnen" komt níét voor; (2) mock met `{ grounded: true, confidence: 0.5, issues: [] }` → waarschuwing zichtbaar (drempelvariant, géén probleemlijst); (3) herlaad-pad: `messages`-REST-mock met twee assistentrijen — één mét `verification: { grounded: true, confidence: 0.9, issues: [] }`, één zónder verification-veld → na `page.goto('/chat/<id>')` toont de eerste "Gecontroleerd tegen de bronnen", de tweede géén verificatieregel en géén `role="alert"`/foutmelding (FR-007). Verifieer FAIL vóór implementatie.

### Implementation for User Story 3

- [x] T010 [P] [US3] Breid in `src/components/chat/MessageBubble.tsx` de interface `ChatMessage` uit met `verification?: RagVerification | null` (import uit `@/lib/rag-client`; data-model §ChatMessage).
- [x] T011 [P] [US3] Draad de verificatiegegevens door in `src/pages/ChatPage.tsx`: (a) in `processQuestion` het assistentbericht aanvullen met `verification: result.verification` (live-pad, `RagChatResult.verification`); (b) in het seeding-effect (regel 105-117) de mapping aanvullen met `verification: parseVerification(m.verification)` (herlaad-pad, jsonb-kolom; `null` bij afwezig/ongeldig formaat — research #3, T002).
- [x] T012 [P] [US3] Voeg aan `src/components/chat/AnswerMeta.tsx` de verificatieregel toe (route-item 2; contracts/chat-source-display.md §3): prop `verification?: RagVerification | null`; benoemde constante `const CONFIDENCE_THRESHOLD = 0.7`; bij `verification && (!verification.grounded || verification.confidence < CONFIDENCE_THRESHOLD)` een amber waarschuwingsblok met `role="note"` (styling-patroon `ResultView.tsx:81-93`): "Dit antwoord is niet volledig onderbouwd door de bronnen." plus "Gevonden problemen:" met `<ul>`-lijst van de issues (alleen als `issues.length > 0`, spec edge case); anders bij aanwezige verificatie een muted regel "Gecontroleerd tegen de bronnen"; géén enkele uitvoer als `verification` ontbreekt of `null` is (FR-007). Alle teksten Nederlands, u-vorm, zonder aanbevelende formuleringen (constitution I+II).
- [x] T013 [US3] Koppel in `src/components/chat/MessageBubble.tsx` `verification={message.verification}` door aan `AnswerMeta` (hangt af van T010 + T012).

**Checkpoint**: US3 werkt zelfstandig — verificatieregel live én na herladen; oude berichten zonder verificatie renderen schoon zonder foutmelding

---

## Phase 6: User Story 4 - Bronnen als genummerde knoppen met zijpaneel (Priority: P1)

**Goal**: Onder elk antwoord staan genummerde bronknoppen `[1]`, `[2]` met documentnaam; activeren opent het hergebruikte `SourcePanel` als zijpaneel met Referentie, Document en Letterlijke passage (Locatie alleen bij niet-lege waarde); Escape sluit en de focus keert terug naar de bronknop; de score-badge en uitklaplijst zijn verdwenen — nergens een percentage.

**Independent Test**: e2e-scenario's (T014) — bronknoppen zichtbaar met documentnamen en zónder `%`; paneel opent (muis én toetsenbord), Escape sluit en de focus staat terug op de bronknop.

### Tests for User Story 4

- [x] T014 [US4] Voeg scenario's toe aan `tests/e2e/answer-presentation.spec.ts` (rag-chat-mock met twee bronnen: `{ title: 'Personeelshandboek', excerpt: 'Vakantiedagen naar rato…', score: 0.92 }` en `{ title: 'CAO-regeling', excerpt: 'Artikel 4 lid 2…', score: 0.88 }`): (1) knoppen `[1] Personeelshandboek` en `[2] CAO-regeling` zichtbaar onder het antwoord; géén `%`-tekst in het berichtenoverzicht (score-badge weg, FR-008); (2) klik op `[1]` → paneel (`role="dialog"`) met `aria-hidden="false"` toont "Personeelshandboek" en de passage "Vakantiedagen naar rato…"; het Locatie-blok ontbreekt (lege `page`, contract §1); (3) `Escape` → paneel `aria-hidden="true"` en de bronknop `[1]` heeft de focus (FR-010); (4) toetsenbord: focus op `[2]` + `Enter` → paneel opent die bron (één paneel tegelijk, FR-012). Verifieer FAIL vóór implementatie.

### Implementation for User Story 4

- [x] T015 [P] [US4] Pas `src/components/analysis/SourcePanel.tsx` minimaal aan (route-item 3; research #5): wikkel het Locatie-blok (regel 56-59) in `{bron.locatie && (…)}` zodat een lege locatie géén label zonder waarde toont. Geen enkele andere wijziging aan de analyse-flow (de analyse heeft altijd een niet-lege locatie, `BronRefSchema` `min(1)`).
- [x] T016 [US4] Breid `src/components/chat/AnswerMeta.tsx` uit met de bronknoppen (route-item 2+3; contracts/chat-source-display.md §1; data-model §BronRef-mapping): props `sources: RagSource[]` en `onOpenBron: (bronnen: BronRef[], bronId: string, trigger: HTMLButtonElement) => void`; mapping `id: 'K' + (index + 1)`, `document: title ?? 'Zonder titel'`, `locatie: page ?? ''`, `passage: excerpt ?? ''` (T002 levert `page`); render per bron een native `<button type="button">` met zichtbare tekst `[n] <documentnaam>` onder de verificatieregel; bij klik/activeren roept de knop `onOpenBron(bronnen, bronRef.id, e.currentTarget)` aan.
- [x] T017 [US4] Realiseer het zijpaneel in `src/components/chat/MessageList.tsx` (research #5, #6; data-model §Bronpaneel-state): state `openBron: { bronnen: BronRef[]; bronId: string; trigger: HTMLButtonElement } | null`; geef via `MessageBubble` een `onOpenBron`-callback door die de state vervangt (één paneel per constructie, FR-012); render één `<SourcePanel bronId={openBron?.bronId ?? null} bronnen={openBron?.bronnen ?? []} onClose={closeBron} />` (bestaand, `fixed` zijpaneel); `closeBron` zet de state op `null` en herstelt de focus: `if (trigger.isConnected) trigger.focus()`; Escape via `document`-keydown-listener, alleen actief zolang het paneel open is (patroon `src/components/ui/dialog.tsx:7-10`); effect dat het paneel sluit bij `conversationId`-wissel (navigatie tussen gesprekken).
- [x] T018 [US4] Ruim de oude bron-UI op in `src/components/chat/MessageBubble.tsx` (route-item 4): verwijder de uitklapbare bronnenlijst met `sourcesExpanded`-state, de score-`Badge` (`Math.round(source.score * 100)}%`), de `ChevronUp`/`ChevronDown`-imports en de lokale `interface Source` (narrow voortaan met `Array.isArray(message.sources) ? (message.sources as RagSource[]) : []` — research #10); geef `sources` en `onOpenBron` door aan `AnswerMeta`; ontvang en geef de nieuwe `onOpenBron`-prop door van `MessageList`.
- [x] T019 [US4] Werk `tests/e2e/rag-chat.spec.ts` bij: vervang de verouderde assertie (regel 156-159: "Bronnen (1)"-uitklapknop + `92%`-badge) door de nieuwe UI — bronknop `[1] Personeelshandboek` zichtbaar en géén `92%` (research #9: alleen de bewust vervallen UI asserten).

**Checkpoint**: US4 werkt zelfstandig — bronknoppen + paneel, Escape + focusterugkeer, nergens percentages of scores

---

## Phase 7: User Story 5 - Eigen vraag letterlijk zichtbaar (Priority: P2)

**Goal**: De vraag van de adviseur staat letterlijk in de chat zoals getypt — regeleinden behouden, tekens als `<b>test</b>` zichtbaar als tekst, géén HTML-interpretatie.

**Independent Test**: e2e-scenario (T020) — de vraag met tag-achtige tekst staat letterlijk in de chat en is geen opmaak.

### Tests for User Story 5

- [x] T020 [US5] Voeg scenario toe aan `tests/e2e/answer-presentation.spec.ts`: stel via de composer een vraag met twee regels ("Eerste regel" + Shift+Enter + "Tweede regel <b>test</b>") → de gebruikersballon toont de tekst letterlijk: `page.getByText('Tweede regel <b>test</b>')` zichtbaar en géén `<b>`-element als opmaak gerenderd in de vraag (React-escaping, research #1). Verifieer FAIL vóór implementatie.

### Implementation for User Story 5

- [x] T021 [US5] Vervang in `src/components/chat/MessageContent.tsx` de gebruikerstak (T004-interim) door letterlijke platte tekst (route-item 1; research #1): render `{content}` als React-tekstnode in de container (automatische escaping, géén `dangerouslySetInnerHTML`, géén sanitizer) — de bestaande `whitespace-pre-wrap`-klasse op de gebruikersballon (`MessageBubble.tsx:52`) behoudt de regeleinden. Verwijder daarna de `sanitizeHtml`-aanroep en (na grep-verificatie: geen consumenten meer in `src/`) de `sanitizeHtml`-functie zelf uit `src/lib/sanitize.ts` — code die door deze wijziging ongebruikt raakt _(uitgevoerd 2026-10-29: grep bevestigde geen code-consumenten meer — alleen de definitie zelf; alleen documentatie verwijst er nog naar; `ALLOWED_ATTR`/`ALLOWED_TAGS` blijven staan omdat `MARKDOWN_ALLOWED_TAGS` eruit samengesteld is)_.

**Checkpoint**: Alle vijf de stories werken onafhankelijk; de volledige route is gedekt

---

## Phase 8: Polish & Verificatie

**Purpose**: Definition of Done (AGENTS.md "After Every Feature") + release (quickstart.md §3 — frontend-only, geen migratie of deploy-volgorde)

- [x] T022 Draai `npx tsc --noEmit`, `npx eslint src/ --max-warnings 0` en `npm run build` — allemaal groen (randvoorwaarden uit de route) _(2026-10-29: tsc 0 errors; eslint src/ 0 errors / 6 pre-existing baseline-warnings (App.tsx/toast.tsx/posthog.tsx, geen enkele uit 013 — de hook behandelt eslint als non-blocking, bekende afwijking); build groen in 4,1 s)_
- [x] T023 Draai de Playwright-suite: `npx playwright test tests/e2e/answer-presentation.spec.ts` (nieuwe gevallen) en `tests/e2e/rag-chat.spec.ts` (aangepaste assertie) groen; daarna `npx playwright test` als volledige regressie — of skip met reden zolang de E2E-accounts uit T001 ontbreken (gedocumenteerde staat) _(2026-10-29: feature-spec + rag-chat samen 18 skipped / 0 failed; volledige suite 64 skipped / 0 failed (55 bestaand + 9 nieuw) — alles wacht op E2E_EMAIL/E2E_PASSWORD)_
- [x] T024 [P] Update `FEATURES.md` via `@feature-tracker` met feature 013 (markdown-weergave, CONCEPT-label, verificatieregel, bronknoppen + paneel, letterlijke vraag) _(2026-10-29: handmatig in feature-tracker-stijl uitgevoerd — nieuw 013-entry, total 21→22, supersede-notitie bij het 007 HTML-weergave-entry; @feature-tracker is handmatig-aanroepen per toolbeschrijving)_
- [x] T025 Fitness check via `@fitness-checker`: `scripts/fitness-check.sh` + F-01 (RLS) en F-10 (buckets) via Supabase MCP — géén DB-wijzigingen in deze feature, dus verificatie dat de bestaande staat ongewijzigd geldig is; schrijf `FITNESS.md` _(2026-10-29: script FAIL:0 / PASS:13 / WARN:1 / SKIP:4; Supabase/Snyk MCP niet actief in de sessie — F-01/F-10/F-16/F-17 gedocumenteerd als open achterstand; FITNESS.md-entry toegevoegd; géén DB-wijziging om te verifiëren)_
- [ ] T026 Release volgens quickstart.md §3: frontend-PR naar `develop` → preview testen → merge naar `main` (één increment met alle stories; US5 is onderdeel van dezelfde PR); daarna handmatige live-verificatie quickstart.md §4 door Jaap (markdown + CONCEPT, verificatieregel, bronpaneel + Escape + focus, letterlijke vraag, herladen van oude gesprekken).

---

## Dependencies & Execution Order

### Fasedenkwoud

- **Phase 1-2**: T001 vooraf (alleen nodig om te draaien, niet om te schrijven); T002 [P] staat los van alle andere taken
- **Phase 3 (US1, MVP)**: T003 (test-first) → T004 → T005; T002 kan parallel
- **Phase 4 (US2)**: T006 (test-first, breidt het spec-bestand van T003 uit) → T007 → T008
- **Phase 5 (US3)**: T009 (test-first) → T010/T011/T012 [P] parallel (verschillende bestanden) → T013 (draad, hangt af van T010+T012)
- **Phase 6 (US4)**: T014 (test-first) → T015 [P] + T016 (verschillende bestanden, parallel) → T017 (hangt af van T016: `onOpenBron`-signatuur) → T018 (hangt af van T016+T017) → T019 (na T018: de oude UI is weg)
- **Phase 7 (US5)**: T020 (test-first) → T021 (vervangt de US1-interim, dus ná T004)
- **Phase 8**: T022 → T023 → T026; T024/T025 [P] na afgeronde implementatie (parallel aan elkaar)

### Binnen elke story

- E2e-scenario schrijven en FAIL aantonen vóór de implementatie van die story
- Data/hook-laag vóór component; component vóór montage; montage vóór pagina-integratie
- Per fase `npx tsc --noEmit` + `npx eslint src/ --max-warnings 0` groen houden (pre-commit gate AGENTS.md)

### Parallel-mogelijkheden

- T002 (rag-client) parallel aan Phase 3-4 (ander bestandengebied)
- T010 + T011 + T012 (US3: `MessageBubble.tsx`, `ChatPage.tsx`, `AnswerMeta.tsx`) onderling parallel
- T015 + T016 (US4: `SourcePanel.tsx`, `AnswerMeta.tsx`) onderling parallel
- T024 + T025 (FEATURES.md + fitness) parallel in Phase 8

---

## Implementation Strategy

**MVP-first**: Phase 1-2 → Phase 3 (US1: leesbare antwoorden, het grootste pijnpunt) valideren → US2 (CONCEPT-label, constitutioneel verplicht) → US3 (verificatieregel) → US4 (bronknoppen + paneel) → US5 (letterlijke vraag) → Phase 8. Technisch MVP is US1; het functionele increment is de volledige P1-block (US1-US4) — klein genoeg voor één PR (quickstart.md §3). Bij elke afgeronde story: `npx tsc --noEmit` + `npx eslint src/ --max-warnings 0` groen; commit per afgeronde user story met conventional message (`feat(chat): …`, constitution I: commits Engels).

---

## Notes

- [P] = verschillende bestanden, geen afhankelijkheden; [Story] mapt op spec.md
- **Afwijking tijdens implementatie (T004-ripple)**: `src/pages/HistoryPage.tsx` deelt het `MessageContent`-component en kreeg daardoor de verplichte één-regelige `role={msg.role}`-doorgeef (tsc vereist de prop). De Geschiedenis-pagina blijft verder volledig onaangeroerd (geen CONCEPT-badge, verificatieregel, bronknoppen of paneel daar; de bron-UI met percentages blijft bestaan tot een aparte beslissing) — alleen de gedeelde inhoudsrendering is consistent geworden: assistentantwoorden tonen daar nu óók markdown en gebruikersvragen letterlijk.
- Bestaande specs worden bewust minimaal gewijzigd: alleen `rag-chat.spec.ts` (oude UI-assertie vervangen, T019); `chat-page.spec.ts`, `answer-feedback.spec.ts` en `admin-only-management.spec.ts` blijven onaangeroerd en geldig (research #9)
- Geen nieuwe npm-dependencies; sanitatie, zod, iconen, Badge/Button en SourcePanel zijn allemaal bestaand (research #11)
- Geen database-, Edge Function- of n8n-wijzigingen: `messages.verification`/`messages.sources` (jsonb, migratie 017) worden alleen gelezen; de Supabase MCP is uitsluitend voor de F-01/F-10-verificatie in T025
- `AnswerMeta` doorloopt bewust basisversies per story (012 T006/T010-patroon): badge (US2) → +verificatieregel (US3) → +bronknoppen (US4); elk tussenstadium is zelfstandig testbaar