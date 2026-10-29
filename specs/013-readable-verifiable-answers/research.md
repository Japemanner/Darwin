# Research: Antwoorden leesbaar, controleerbaar en als CONCEPT gemarkeerd

**Date**: 2026-10-29 | **Feature**: [spec.md](spec.md) | **Branch**: `013-readable-verifiable-answers`

Alle onbekenden zijn onderzocht in de codebase (`src/components/chat/MessageContent.tsx`,
`MessageBubble.tsx`, `MessageList.tsx`, `AnswerFeedback.tsx`, `src/pages/ChatPage.tsx`,
`src/lib/sanitize.ts`, `src/lib/rag-client.ts`, `src/components/analysis/SourcePanel.tsx`,
`AnalysisMarkdown.tsx`, `ResultView.tsx`, `AnalysisFlow.tsx`, `src/lib/analysis-schemas.ts`,
`src/types/database.types.ts`, `supabase/functions/rag-chat/index.ts`,
`tailwind.config.js`, `package.json`, `tests/e2e/rag-chat.spec.ts`, `chat-page.spec.ts`,
`answer-feedback.spec.ts`, `admin-only-management.spec.ts`, `fixtures.ts`, en de
contracten/data-modellen van feature 011 en 012). Geen onopgeloste NEEDS CLARIFICATION.
Bevindingen per beslissing.

## 1. Assistent: `sanitizeMarkdown`; gebruiker: platte React-tekst

**Decision**: `MessageContent` krijgt een `role: 'user' | 'assistant'`-prop.
Assistentcontent gaat door de bestaande `sanitizeMarkdown` (`src/lib/sanitize.ts:28`);
gebruikerscontent wordt als letterlijke React-tekstnode gerenderd (geen
`dangerouslySetInnerHTML`, geen sanitizer — React escapet vanzelf), met de bestaande
`whitespace-pre-wrap` op de gebruikersballon (`MessageBubble.tsx:52`) voor regeleinden.

**Rationale**: `MARKDOWN_ALLOWED_TAGS` (`sanitize.ts:11`) bevat precies wat de spec
vraagt: `p`, `ul`, `ol`, `li`, `strong` én `h4`, `table`, `thead`, `tbody`, `tr`, `th`,
`td` — alinea's, opsommingen, vet en tabellen werken direct. De bestaande
afterSanitizeAttributes-hook (`sanitize.ts:16-21`) zet op élke `<a>` `target="_blank"`
en `rel="noopener noreferrer"` — FR-002 is dus gratis voldaan. Gebruikersvragen zijn
ingevoerde tekst, geen opmaak: React's automatische escaping toont `<b>test</b>`
letterlijk (US5), terwijl de oude `sanitizeHtml`-route ingetypte toegestane tags
(`strong`, `a`, …) als opmaak interpreteerde.

**Alternatives considered**:
- `sanitizeHtml` behouden en markdown vooraf parsen — afgewezen: dubbele pipeline,
  `sanitizeMarkdown` bestaat al en is de expliciete route-opdracht.
- `marked` met `breaks: true` voor enkele regeleinden — afgewezen: standaard
  alinea-semantiek (dubbele regeleinde = alinea) is wat de spec noemt; geen
  speculatieve configuratie (constitution VI).

## 2. Opmaak via Tailwind-varianten op de container; géén @tailwindcss/typography

**Decision**: de assistent-container in `MessageContent` krijgt Tailwind-classes met
arbitrary variants die de genoemde kindelementen stylen (`[&_p]:…`, `[&_ul]:…`,
`[&_ol]:…`, `[&_li]:…`, `[&_strong]:…`, `[&_table]:…`, `[&_th]:…`, `[&_td]:…`).
`@tailwindcss/typography` wordt NIET toegevoegd (`package.json` heeft het niet;
`tailwind.config.js` heeft `plugins: []`).

**Rationale**: de markdown-HTML komt via `dangerouslySetInnerHTML` binnen, dus de
elementen krijgen zelf geen classes — descendant-selectors via arbitrary variants zijn
het idiomele Tailwind-middel hiervoor. De route noemt de elementen expliciet (ul, ol,
li, strong, table, th, td); `p` voegen we toe voor alinea-marges (spec FR-001 noemt
alinea's). Overige toegestane tags (h1-h4, blockquote, code, pre, em, a) vallen terug
op browser-defaults — bewust geen styling toevoegen die de route niet noemt
(constitution VI).

**Alternatives considered**:
- `@tailwindcss/typography` installeren (`prose`) — afgewezen: route verbiedt dit
  expliciet; nieuwe dependency voor iets dat een handjevol varianten ook doet.
- `prose`-classes hergebruiken zoals `AnalysisMarkdown` dat doet — afgewezen: zonder
  de plugin zijn die classes inactief (zie hieronder), en de analyse-flow is buiten
  scope.

**Opvallende bevinding (geen actie)**: `AnalysisMarkdown.tsx:38` gebruikt
`prose prose-sm`, maar zonder de typography-plugin genereren die classes géén CSS — de
analyse heeft dus feitelijk geen markdown-opmaak. Dat is een bestaand tekort buiten
deze scope ("verder geen wijzigingen aan de analyse-flow"); niet aanpassen
(surgical changes), wel benoemen voor het vervolg.

## 3. Verificatiegegevens zijn al beschikbaar — ze worden alleen weggegooid

**Decision**: `ChatMessage` (interface in `MessageBubble.tsx`) krijgt
`verification?: RagVerification | null`. `ChatPage.processQuestion` zet
`result.verification` (live antwoord, `rag-client.ts:96`) op het assistentbericht;
de seeding van bestaande gesprekken (`ChatPage.tsx:105-117`) mapt `m.verification`
uit de databaserij en narrowt die met een nieuwe, geëxporteerde
`parseVerification(value: unknown): RagVerification | null` in `rag-client.ts`
(zod `safeParse`; `null` bij afwezig of ongeldig formaat).

**Rationale**: de vorm is overal dezelfde en al gedocumenteerd: het edge function
contract (011) levert `verification: { grounded, confidence, issues }` ongeïnterpreteerd
door uit n8n; de Edge Function normaliseert
(`verification_grounded`/`verification_confidence`/`verification_issues` →
`{ grounded, confidence, issues }`, `supabase/functions/rag-chat/index.ts:159-167`)
en persisteert dat sinds migratie 017 als jsonb in `messages.verification` (data-model
012). `database.types.ts:321` typt die kolom als `Record<string, unknown> | null` —
vandaar de narrowing in plaats van een blinde cast. `null`-fallback is géén stille
fout maar het gespecificeerde UI-gedrag (FR-007 + spec edge case "verificatiegegevens
in onverwacht formaat → geen verificatieregel, geen foutmelding"); de zod-parse is
constitution V-conform (getypeerd, expliciet).

**Alternatives considered**:
- Cast zonder validatie (`m.verification as RagVerification`) — afgewezen: een
  corrupte jsonb-rij zou de chat-rendering kunnen breken; de spec eist expliciet
  foutloos doorrenderen.
- Nieuwe aparte helper-module — afgewezen: het schema zit al in `rag-client.ts` als
  inline zod-schema; extraheren naar modulniveau + exporteren is de minimale wijziging.

## 4. Bronmapping naar `BronRef`; `page`-veld toevoegen aan de client-schema

**Decision**: `AnswerMeta` mapt chatbronnen naar `BronRef[]`:
`id = 'K' + (index + 1)`, `document = title ?? 'Zonder titel'`,
`locatie = page ?? ''`, `passage = excerpt ?? ''`. `RagSourceSchema` en het type
`RagSource` in `rag-client.ts` krijgen een optioneel veld `page?: string`.

**Rationale**: `BronRef` (`analysis-schemas.ts:6-11`) vereist `id` matchend met
`^[KRA][0-9]+$` — de K-prefix is de bestaande analyseconventie (K = kennisbron,
`analysis-schemas.ts:4`), dus `'K' + (index + 1)` is schema-conform en consistent met
`AnalysisMarkdown`'s `[K1]`-referentiepatroon. De route schrijft `locatie = page ?? ''`
voor: n8n levert nóg géén locatie (buiten scope), maar het `messages.sources`-jsonb
geeft de waarde straks ongemoeid door, en de live-path filtert hem nu weg —
`RagSourceSchema` (zod, default `strip` van onbekende keys) laat een toekomstig
`page`-veld uit de n8n-respons niet door. Eén optioneel veld in de bestaande schema
(zonder serverwijziging, contract v2 ongemoeid) maakt de mapping toekomstbestendig
én identiek voor beide paden. `''` is een geldige `string` voor het TypeScript-type
`BronRef`; het zod-schema (`locatie: min(1)`) valideert alleen analyse-API-antwoorden
en wordt níét voor chatbronnen gebruikt.

**Alternatives considered**:
- `locatie` hard `''` zonder `page`-veld — afgewezen: de route-specificeert
  `page ?? ''`; zonder schemaveld zou het live-pad een straks geleverde locatie
  structureel verbergen.
- BronRefSchema versoepelen naar `locatie: z.string()` — afgewezen: geen enkele
  noodzaak (chatbronnen worden geconstrueerd, niet gevalideerd); analyse-contract
  ongemoeid laten.

## 5. `SourcePanel`-hergebruik: alleen Locatie verbergen; Escape + focus in de chat

**Decision**: `SourcePanel` krijgt één minimale wijziging: het Locatie-blok wordt
conditioneel (`{bron.locatie && …}`) zodat een lege locatie geen leeg label toont.
Escape-afhandeling en focusterugkeer worden NIET in `SourcePanel` gebouwd maar in
de chat: `MessageList` houdt `openBron: { bronnen, bronId, trigger } | null` bij,
hangt een document-keydown-listener voor Escape (identiek patroon aan
`src/components/ui/dialog.tsx:7-10`), en zet bij sluiten de focus terug op de
opgeslagen bronknop.

**Rationale**: het huidige `SourcePanel` (een vast, vertaalfix paneel met
`role="dialog"`, `aria-hidden` + `inert` bij dicht, en focus op de sluitknop bij
openen, `SourcePanel.tsx:15-17`) behandelt Escape nergens — de analyse-flow ook
niet. De route beperkt de SourcePanel-wijziging expliciet tot het Locatie-gedrag;
de accessibility-eisen (FR-010) zijn chat-eisen en horen dus in de chat-wiring.
Het bestaande focusgedrag bij openen (sluitknop) is een acceptabel dialog-patroon:
de focus staat ín het paneel zolang het open is en keert bij sluiten terug naar de
bronknop.

**Alternatives considered**:
- Escape + focusterugkeer als props in `SourcePanel` inbouwen — afgewezen: wijzig
  de gedeelde component verder dan de route toestaat, met regressierisico voor de
  analyse-flow.
- Focus-trap in het paneel bouwen — afgewezen: het bestaande analyse-patroon heeft
  dat ook niet; de spec vraagt openen, Escape-sluiten en focusterugkeer, geen trap
  (constitution VI, consistentie boven uitbreiding).

## 6. Eén panelinstantie in `MessageList`; sluiten bij gesprekwissel; guard op trigger

**Decision**: `MessageList` rendert één `SourcePanel`-instantie en houdt de open
bron-toestand bij (met de bronknop als `trigger`-element). Bij
`onOpenBron(bronnen, bronId, trigger)` wordt de toestand vervangen — er is per
constructie nooit meer dan één paneel open (FR-012). Een effect sluit het paneel
bij wijziging van `conversationId` (navigatie tussen gesprekken / eerste antwoord
nadat het vaste adres ontstaat). Bij sluiten: `if (trigger.isConnected)
trigger.focus()`.

**Rationale**: één instantie boven de berichtenlijst voldoet voor alle antwoorden
(het paneel is `fixed` gepositioneerd); per-antwoord panelen zouden de
één-paneel-regel kunnen schenden en N instanties renderen. `isConnected` voorkomt
een crash als de triggerknop (bijv. na reset) is verdwenen — focus valt dan terug
op `body`, zonder foutmelding.

**Alternatives considered**:
- Panel-state in `ChatPage` — afgewezen: `ChatPage` hoeft dan toch alleen door te
  geven; `MessageList` is de natuurlijke host (rendert al alle berichten) en
  beperkt de ChatPage-wijzigingen tot de verificatie-draden.
- Per-antwoord state in `AnswerMeta` — afgewezen: twee antwoorden kunnen dan
  tegelijk "open" zijn (FR-012-schending) en het paneel dupliceert.

## 7. CONCEPT-formulering volgt de bestaande app-conventie

**Decision**: het label onder elk antwoord gebruikt de bestaande formulering
"CONCEPT, door adviseur te accorderen" (`AnalysisFlow.tsx:90`, `ResultView.tsx:64`,
download-knop `ResultView.tsx:103`) als `Badge` naast het antwoord.

**Rationale**: constitution II eist per gegenereerde output een zichtbaar
"CONCEPT"-label; de spec-aanname zegt "sluit aan bij de bestaande
formulieringsconventie". De bestaande zin is overal in de app identiek en is
feitelijke, niet-aanbevelende tekst — hergebruik garandeert consistentie tussen
risico-analyse en chat.

**Alternatives considered**:
- Alleen het woord "CONCEPT" — afgewezen: de spec-aanname noemt de bestaande
  conventie expliciet als uitgangspunt; de lange variant legt bovendien uit wat de
  adviseur moet doen (accorderen) zonder aanbevelend te zijn.

## 8. Waarschuwingssemantiek en drempel

**Decision**: constante `CONFIDENCE_THRESHOLD = 0.7` in `AnswerMeta.tsx`. Waarschuwing
als `!verification.grounded || verification.confidence < CONFIDENCE_THRESHOLD`;
"Gecontroleerd tegen de bronnen" als `verification.grounded === true && confidence >=
CONFIDENCE_THRESHOLD`; géén regel als `verification` ontbreekt. De waarschuwing toont
de gevonden problemen als lijst, alleen als `issues.length > 0`.

**Rationale**: exact de acceptatiecriteria ("grounded = false óf confidence < 0,7";
"bij 0,7 geen waarschuwing" — strikt kleiner-dan, spec edge case). De drempel als
benoemde constante is een expliciet acceptatiecriterium. Lege `issues` bij
`grounded = false` laat de waarschuwing bestaan zonder probleemlijst (spec edge
case).

**Alternatives considered**:
- Drempel in een config-bestand — afgewezen: één consument (`AnswerMeta`); een
  apart bestand is speculatieve configureerbaarheid (constitution VI).

## 9. Testimpact: één bestaande assertie veroudert, de rest blijft geldig

**Decision**: `rag-chat.spec.ts:156-159` ("Sources still render including the score
badge (unchanged UI)" — `Bronnen (1)`-knop + `92%`) wordt aangepast naar de nieuwe
UI (bronknop `[1] Personeelshandboek` zichtbaar, géén `92%`). De overige specs
blijven ongemoeid. Nieuw: `answer-presentation.spec.ts`, volledig gemocked volgens
het bestaande `page.route`-patroon (`ai_assistants`, `conversations`, `messages`,
`feedback_interactions`, `rag-chat`).

**Rationale**:
- `chat-page.spec.ts` asserteert tekst-zichtbaarheid van antwoorden (`getByText`)
  en de vraag — platte antwoorden renderen als alinea (nog steeds zichtbaar),
  vragen als letterlijke tekst (nog steeds zichtbaar); `sources: []` → geen
  bronknoppen; geen score-asserties.
- `answer-feedback.spec.ts` seedt via de echte Supabase-client zonder
  `sources`/`verification`-velden (null) → AnswerMeta toont alleen CONCEPT-badge,
  geen verificatieregel, geen bronknoppen; de duim/reden-asserties botsen nergens
  mee.
- `admin-only-management.spec.ts` gebruikt `RAG_ANSWER` (lege bronnen, verificatie
  `grounded: true`) maar asserteert alleen navigatie en de composer-placeholder
  (`admin-only-management.spec.ts:295-297`) — geen bron-UI.
- Nieuwe spec dekt: markdown-lijst rendert als lijst, CONCEPT-label aanwezig,
  waarschuwing bij `grounded = false` (plus `confidence < 0,7`-variant),
  bronknop → paneel → Escape → focusterugkeer, géén `%` bij bronnen, XSS-poging
  niet uitgevoerd, letterlijke vraag (US5) en het herlaad-pad met én zonder
  verificatiegegevens (FR-007).

**Alternatives considered**:
- Alleen de zes route-gevallen testen — afgewezen: FR-007/US5 horen bij de
  acceptatiecriteria van de spec; beide zijn met hetzelfde mock-patroon goedkoop
  af te dekken (goal-driven execution).

## 10. `page`-veld en `Source`-type opruimen in `MessageBubble`

**Decision**: de lokale `interface Source` in `MessageBubble.tsx:23-28` vervalt;
het narrowing-cast gebruikt voortaan `RagSource[]` uit `rag-client.ts` (via
`Array.isArray(message.sources)`, zoals al gebeurt op regel 42).

**Rationale**: na verwijdering van score-badge en uitklaplijst heeft `MessageBubble`
het lokale type niet meer nodig; `RagSource` is de getypeerde bronvorm (constitution
V) en voorkomt dubbele type-definities. De `sources: unknown` op `ChatMessage`
blijft (persisted jsonb-rijen én live `RagSource[]`).

**Alternatives considered**:
- Lokale `Source`-interface behouden met `page?: string` — afgewezen: duplicaat van
  het client-type; twee plaatsen om bij te houden bij de eerstvolgende bron-wijziging.

## 11. Geen nieuwe dependencies

**Decision**: alles is afgedekt door bestaande dependencies: `marked` + `dompurify`
(sanitatie, al in gebruik door de analyse), `zod` (verificatie-narrowing, al in
gebruik), `lucide-react` (iconen), shadcn `Badge`/`Button` (bestaand), Tailwind
(container-styling), Playwright (e2e). `@tailwindcss/typography` wordt expliciet
NIET toegevoegd (route + research #2).

**Rationale**: constitution VI en de randvoorwaarde "geen nieuwe npm-dependencies".
Er is geen functionaliteit die een extra package nodig heeft.