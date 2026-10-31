# FEATURES.md — Application Feature Registry

_Last updated: 2026-10-31_
_Total features: 25_

---

## Legend

| Symbol | Meaning                        |
|--------|-------------------------------|
| ✅     | Implemented & tested           |
| 🧪     | Implemented, tests pending     |
| ❌     | Planned, not yet implemented   |
| ⚠️     | Known issue / degraded         |

---

## Features

### ✅ Authenticatie — Supabase Auth (PKCE)

Login met email/wachtwoord via Supabase Auth, PKCE flow, sessiebeheer met auto-refresh, profiel ophalen bij login.

**Files**: `src/components/auth/LoginPage.tsx`, `src/lib/supabase.ts`, `src/store/authStore.ts`, `src/hooks/useAuth.ts`

---

### ✅ Beveiligde Routing — ProtectedRoute

Niet-ingelogde gebruikers worden naar `/login` gestuurd. Alle app-pagina's zitten achter een auth-check met loading state.

**Files**: `src/components/auth/ProtectedRoute.tsx`, `src/App.tsx`

---

### ✅ Applicatie Layout — AppShell + Sidebar

Linker sidebar met navigatie (Command Center, Assistenten, Kennisbronnen, Team), gebruikersavatar, rol-badge, en uitlogknop. Team-link alleen zichtbaar voor admins.

**Files**: `src/components/layout/AppShell.tsx`

---

### ✅ Command Center — Welkom & Statistieken

Welkom met voornaam + real-time statistieken: aantal assistenten, kennisbronnen, teamleden. Taken-kaart is placeholder ("Binnenkort").

**Files**: `src/pages/CommandCenterPage.tsx`

---

### ✅ AI Assistenten — Volledig CRUD (admin-only)

Assistenten aanmaken, bewerken, bekijken, verwijderen. Velden: naam, emoji, beschrijving, system prompt, N8N webhook URL, actief/inactief. Per organisatie gescoped via RLS. Sinds feature 010 is het beheer admin-only: members zien alleen actieve assistenten (leesbare typelabels "Chat"/"Risico-analyse", omschrijving zonder system-prompt-fallback) en kunnen uitsluitend chatten/analyseren.

**Files**: `src/pages/AssistantsPage.tsx`

---

### ❌ AI Chat — Gesprek met Assistent (zijpaneel)

Slide-out chat panel per assistent. Laadt of maakt een conversatie, stuurt berichten naar N8N webhook, toont antwoord. Alle berichten worden opgeslagen in de database.

**Files**: `src/pages/AssistantsPage.tsx` (ChatWindow component)

_Removed: 2026-10-19 — vervangen door feature 011 "Chat als eigen pagina met hervatbare gesprekken" (zie hieronder). De "geen retry"-gap is daarin opgelost; webhook-validatie bij opslaan van een assistent blijft een open punt._

---

### ✅ Kennisbronnen — Volledig CRUD (admin-only)

Kennisbronnen aanmaken, bewerken, bekijken. Velden: naam, beschrijving. Per organisatie gescoped. Sinds feature 010 admin-only: members zien bronnen, documenten en statussen alleen-lezen (KBSlideOver zonder upload/bewerk/verwijderbesturing). Sinds feature 016 tonen kaarten het aantal documenten, het aantal fouten en de laatste wijziging; de naam is vergrendeld zodra de bron documenten bevat (de zoekfunctie filtert op naam); het veld Vector Collection ID en het tabblad Kennisitems zijn uit de UI verdwenen - de kolom, de payload en de kennisitem-data blijven bestaan.

**Files**: `src/pages/KnowledgePage.tsx` (grid + KBMappingModal)

---

### 🧪 Document Upload & Beheer — Supabase Storage + N8N Webhook

Documenten (PDF/TXT/DOCX) uploaden naar Supabase Storage, DB-record aanmaken met status `processing`, gesigneerde download URL (15 min) genereren, N8N webhook versturen met `{ tenant_id, document_name, document_type, download_url }`. Verwijderen uit storage + DB.

**Files**: `src/lib/storage.ts`, `src/pages/KnowledgePage.tsx` (KBSlideOver)

**Status**: Documentstatus wordt door N8N bijgewerkt (processing/ready/error). Sinds feature 016 ververst de documentlijst elke 5 s zolang een document in verwerking is en stopt daarna; een fout toont "Fout" met `error_message` (of een algemene tekst) en een knop "Opnieuw verwerken" die `document-webhook` met actie `index` aanroept (de server zet de status op processing en wist de reden). Uploaden ondersteunt meerdere bestanden, drag-and-drop en een toetsenbordknop, met status per bestand; verwijderen vraagt om bevestiging met de naam.

---

### 🧪 Gekoppelde Assistenten — Weergave (read-only)

Toont welke assistenten aan een kennisbron gekoppeld zijn via de `assistant_knowledge_bases` junction table.

**Files**: `src/pages/KnowledgePage.tsx` (Gekoppelde assistenten tab)

**Gap**: Geen UI om assistenten te koppelen/ontkoppelen — tabel en RLS bestaan maar er is geen frontend voor.

---

### ✅ Team Beheer — Leden & Uitnodigingen

Lijst van organisatieleden + openstaande uitnodigingen. Admins kunnen nieuwe leden uitnodigen per email met rol (admin/lid) en uitnodigingen intrekken. Verstuurd via Supabase Edge Function.

**Files**: `src/pages/TeamPage.tsx`, `supabase/functions/invite-user/index.ts`

---

### ✅ Edge Function — invite-user

Admin-only endpoint die een gebruiker uitnodigt via `supabase.auth.admin.inviteUserByEmail()`. Gebruikt service role key (nooit in client).

**Files**: `supabase/functions/invite-user/index.ts`

---

### ✅ Multi-tenancy — RLS op alle tabellen

Elke tabel heeft `organization_id` en RLS policies. Helper-functie `get_user_org_id()` zorgt dat gebruikers alleen data van hun eigen organisatie zien. Auto-profiel aanmaken bij signup.

**Files**: `supabase/migrations/001_initial_schema.sql`

---

### ✅ UI Component Library — shadcn/ui

Button, Input, Label, Textarea, Card, Dialog, Select, Badge, Avatar, Skeleton, Spinner, Table, Toast, EmptyState.

**Files**: `src/components/ui/`

---

### ✅ Netlify Deployment — SPA Hosting

Deployed op Netlify met SPA redirects (`/* → /index.html`), Node 20 build.

**Files**: `netlify.toml`

---

### ⚠️ React Query — Infrastructuur (ongebruikt)

`QueryClientProvider` is ingesteld in App.tsx maar geen enkele pagina gebruikt `useQuery` of `useMutation`. Data fetching gebeurt via handmatige `useEffect` + `useState` patronen.

**Files**: `src/App.tsx`

---

### ⚠️ Testing — Playwright (nog niet opgezet)

AGENTS.md mandateert Playwright tests na elke feature, maar de `tests/` directory bestaat niet.

---

### 🧪 HTML-weergave Assistent-antwoorden — DOMPurify sanitization

Assistent-antwoorden worden als HTML aangeleverd (door n8n) en veilig weergegeven via DOMPurify-sanitization met een strikte allow-list. Eén gedeelde `MessageContent`-component vervangt de gedupliceerde `{msg.content}`-rendering in zowel de live chat als de geschiedenis-weergave. Visuele vormgeving ongewijzigd: zelfde bubble-stijl, lettergrootte, kleuren en padding. Oude platte-tekst berichten blijven correct zichtbaar (DOMPurify laat platte tekst ongemoeid).

**Files**: `src/components/chat/MessageContent.tsx`, `src/lib/sanitize.ts`, `src/pages/AssistantsPage.tsx`, `src/pages/HistoryPage.tsx`

**Gap**: Playwright-tests (XSS-preventie, visueel-identiek check) nog te schrijven — tests/ directory ontbreekt.

_Updated 2026-10-29 — feature 013 vervangt deze weergave: assistent-antwoorden renderen nu via `sanitizeMarkdown` (echte markdown-opmaak), gebruikersberichten letterlijk als platte tekst; `sanitizeHtml` is verwijderd. Zie "Antwoorden leesbaar, controleerbaar en als CONCEPT gemarkeerd (013)" hieronder._

---

### 🧪 Risico-analyse assistent UI (008)

Chat-stijl vaste flow voor het nieuwe assistent-type `risico_analyse` (geen vrije chat): invoerformulier (Verzekeringsvraagstuk, Kennisbronnen multi-select, Klantsituatie, Bestanden pdf/docx/txt met limieten zichtbaar, https-only URL's, Klantreferentie, Adviseur prefilled) met groepsvalidatie; asynchrone run met statuskaart (in wachtrij/bezig/klaar/mislukt, elapsed time, polling 3s met backoff); resultatenweergave met gaps-checklist "Ontbrekende informatie voor het gesprek", interne analyse als gesanitiseerde markdown (marked naar DOMPurify, geen raw HTML), klikbare bronverwijzingen (K/R/A) met zijpaneel (document, locatie, passage), .docx-download met label "CONCEPT, door adviseur te accorderen", copy-to-clipboard, bewaartermijn-melding (7 dagen); foutafhandeling met foutcode en retry-prefill (in-memory, geen browseropslag van klantinhoud). Mock-first: run-flow tegen `scripts/mock-analysis-server.mjs` via `VITE_ANALYSIS_API_URL`; echte backend gecontracteerd in `specs/008-risico-analyse-ui/contracts/`. De client stuurt sinds feature 009 het sessie-JWT mee op alle drie de calls.

**Files**: `src/components/analysis/*`, `src/lib/analysis-client.ts`, `src/lib/analysis-schemas.ts`, `src/hooks/useAnalysisRun.ts`, `src/hooks/useRecentRuns.ts`, `src/lib/sanitize.ts`, `scripts/mock-analysis-server.mjs`, `tests/e2e/analysis-form.spec.ts`, `tests/e2e/analysis-run.spec.ts`, `tests/e2e/analysis-jwt.spec.ts`, `playwright.config.ts`

**Gap**: E2E-suite vereist testaccount (E2E_EMAIL/E2E_PASSWORD); draait verder tegen de mock server.

_Updated 2026-10-30 — feature 014 verplaatst de flow naar eigen pagina's (`/analyse/new/:assistantId` en `/analyse/:runId`) en verwijderde het zijpaneel `AnalysisFlow`; de formuliercomponenten zijn hergebruikt en uitgebreid. Zie "Risico-analyse als eigen pagina, met soepelere invoer (014)" hieronder._

---

### 🧪 Beveiligde n8n-koppeling via de server (009)

Geen geheim en geen tenant-beslissing meer in de browser. Drie Supabase Edge Functions: `rag-chat` (sessiecheck, organisatie/kennisbronnen server-side, payload met `knowledge_sources`-lijst + legacy `knowledgeSourceName`, 60s n8n-fetch, genormaliseerd antwoord met `verification`/`rewritten_query`), `document-webhook` (upload/verwijder-melding met server-gemaakte signed URL 900s; verwijderen meldt vóór de lokale delete) en `flow-config` (get/save/test voor beheerders; token platte tekst en write-only). Frontend: typed clients `rag-client.ts`/`flow-config-client.ts` + typed invoke in `storage.ts`, alle fouten Nederlandse meldingen met foutcodes, `src/lib/webhook.ts` en `VITE_ENCRYPTION_KEY` volledig verwijderd, toast-component toegankelijk gemaakt (role=status/alert, aria-live), fitness-check F-18 dwingt de client-side crypto af, migratie 014 wist gelekte tokens + trekt leesrechten in (kolom-grants) + sluit de UPDATE-policy met `WITH CHECK`. Rest-risico (geaccepteerd): de token-loze per-assistent fallback-URL blijft rechtstreeks bij n8n aanroepbaar.

**Files**: `supabase/functions/rag-chat/index.ts`, `supabase/functions/document-webhook/index.ts`, `supabase/functions/flow-config/index.ts`, `src/lib/rag-client.ts`, `src/lib/flow-config-client.ts`, `src/lib/storage.ts`, `src/lib/analysis-client.ts`, `src/pages/AssistantsPage.tsx`, `src/pages/SettingsPage.tsx`, `src/pages/KnowledgePage.tsx`, `src/hooks/queries.ts`, `src/components/ui/toast.tsx`, `src/vite-env.d.ts`, `supabase/migrations/014_flow_configs_token_lockdown.sql`, `scripts/fitness-check.sh` (F-18), `tests/e2e/rag-chat.spec.ts`, `tests/e2e/document-webhook.spec.ts`, `tests/e2e/flow-config.spec.ts`

**Gap**: E2E draait tegen `page.route`-mocks (vereist E2E_EMAIL/E2E_PASSWORD); rollout vereist handmatige stappen (releasevolgorde: functions → frontend → migratie 014 → token-invoer per organisatie) volgens `specs/009-secure-n8n-proxy/quickstart.md`. Leden-gate van de Instellingen is server-side afgedwongen; e2e voor het member-pad volgt met feature B (tweede testaccount).

---

### 🧪 Beheerfuncties alleen voor beheerders (010)

Assistenten- en kennisbronbeheer is beheerder-only, in de UI én afgedwongen op databaseniveau. UI: conditioneel renderen per rol (`profile.role === 'admin'`) in AssistantsPage (geen aanmaak/bewerkknop voor members, typelabelmap chat→"Chat"/risico_analyse→"Risico-analyse", geen system-prompt-fallback, members zien alleen actieve assistenten, admins zien inactieve met badge "Inactief") en KnowledgePage/KBSlideOver (geen aanmaak/bewerk/upload/verwijder/item-formulier voor members; documentstatus en leesweergaven blijven). Database: migratie `015_admin_only_writes.sql` met helper `is_org_admin()` vervangt de schrijf-policies op `ai_assistants`, `knowledge_bases`, `knowledge_base_documents`, `knowledge_items` en `assistant_knowledge_bases` door admin-only-versies en hardent de storage-policies (INSERT/UPDATE/DELETE) van bucket `knowledge-documents`; leesrechten binnen de eigen organisatie en eigen gesprekken/berichten/feedback (`feedback_interactions`) blijven ongewijzigd. Verificatie: `scripts/rls-verify.mjs` test de 15 schrijfcombinaties + storage + positieve checks direct tegen de live database; e2e-suite `tests/e2e/admin-only-management.spec.ts` (15 tests) dekt member-leesweergave, toetsenbord-onbereikbaarheid en admin-pariteit met de `memberPage`-fixture.

**Files**: `src/pages/AssistantsPage.tsx`, `src/pages/KnowledgePage.tsx`, `tests/e2e/fixtures.ts`, `tests/e2e/admin-only-management.spec.ts`, `scripts/rls-verify.mjs`, `supabase/migrations/015_admin_only_writes.sql`, `.env.example`

**Gap**: migratie 015 is op 2026-10-16 toegepast op productie — maar vóór de frontend-deploy (afwijking van de verplichte releasevolgorde in `specs/010-admin-only-management/quickstart.md` §3, zie `decisions/2026-10-16-010-migratie-voor-frontend-deploy.md`). Nog open: `node scripts/rls-verify.mjs` (SC-001/002) en de §4 SQL-controles — vereisen een member-testaccount (E2E_MEMBER_EMAIL/E2E_MEMBER_PASSWORD in `.env.local`) en een geldige SUPABASE_ACCESS_TOKEN voor F-01/F-10 (huidige token: 401); de e2e-regressiesuite draait pas echt met E2E-credentials (47 skipped / 0 failed zonder).

---

### 🧪 Chat als eigen pagina met hervatbare gesprekken (011)

De chat verhuist uit het verwijderde zijpaneel naar een eigen pagina op volle breedte met vaste adressen: `/chat/new/:assistantId` opent een leeg gesprek, na de eerste vraag vervangt de client de URL door `/chat/:conversationId` (id-only — herladen, terug-/vooruitnavigatie en later voortzetten werken; bestaande gesprekken seeden opnieuw via `useConversation`/`useConversationMessages`, met niet-gevonden-states en terugkeerlink). Meerregelige composer: Enter verstuurt, Shift+Enter geeft een nieuwe regel, auto-grow tot ±8 regels, uitgeschakeld tijdens versturen, focus keert na elke versturing terug. Foutafhandeling: een mislukt antwoord laat de vraag staan met inline NL-reden en knop "Opnieuw proberen" — retry hergebruikt exact hetzelfde `message_id` (geen dubbele vragen, geen toast-fouten bij versturen). Voorbeeldvragen: beheerders stellen per assistent maximaal 4 vragen in (AssistantModal, één per regel, >4 blokkeert opslaan met inline melding); een nieuw gesprek toont omschrijving en voorbeeldvragen als knoppen die direct versturen. Verder: kopieerknop onder elk antwoord ("Gekopieerd"/"Kopiëren is mislukt"), "Nieuw gesprek" behoudt het eerdere gesprek (browser-terug keert ernaar terug), wachtmelding "Dit duurt langer dan gebruikelijk." na 15 s binnen de aria-live-regio (gecleared bij succes, fout én unmount). Server: `rag-chat` v2 — `message_id`-uuid-validatie, message-first gespreksresolutie (bericht-lookup is autoritatief t.o.v. request-`conversation_id`), gebruikersbericht-upsert `ON CONFLICT DO NOTHING`, assistentbericht-insert, `conversations.updated_at`-update, v2-respons; titel van een nieuw gesprek is de eerste vraag (getrimd, afgekapt op 80 tekens, '…' alleen bij afkapping); legacy v1-pad blijft tijdelijk bestaan (verwijderingsnotitie in de functie). Migratie 016 voegt `ai_assistants.example_questions TEXT[] NOT NULL DEFAULT '{}'` toe.

**Files**: `src/pages/ChatPage.tsx`, `src/components/chat/ChatHeader.tsx`, `src/components/chat/ChatEmptyState.tsx`, `src/components/chat/MessageList.tsx`, `src/components/chat/MessageBubble.tsx`, `src/components/chat/ChatComposer.tsx`, `src/pages/AssistantsPage.tsx`, `src/App.tsx`, `src/lib/rag-client.ts`, `src/hooks/queries.ts`, `src/types/database.types.ts`, `supabase/functions/rag-chat/index.ts`, `supabase/migrations/016_assistant_example_questions.sql`, `tests/e2e/chat-page.spec.ts`, `tests/e2e/rag-chat.spec.ts`, `tests/e2e/admin-only-management.spec.ts`

**Gap**: uitrol staat open volgens `specs/011-resumable-chat-page/quickstart.md` §3-§5 (migratie 016 + `rag-chat` v2 via Supabase MCP, frontend-release, handmatige live-verificatie, titel-SQL-check T025) — voor Jaap na de code-review; de e2e-suite (51 tests, incl. 4 nieuwe chat-page-gevallen) draait pas echt met E2E_EMAIL/E2E_PASSWORD in `.env.local`; F-01/F-10 (Supabase MCP) en F-16/F-17 (Snyk MCP) vereisen een MCP-sessie.

---

### 🧪 Feedback per antwoord, en vastleggen hoe een antwoord tot stand kwam (012)

Duim omhoog/omlaag per individueel antwoord (niet langer per gesprek): onder elk afgeronden assistentbericht staat `AnswerFeedback` met `aria-pressed` en NL-toegankelijke labels ("Antwoord is nuttig"/"Antwoord is niet nuttig"); omhoog slaat direct op (één klik), omlaag opent een inline redenscherm (fieldset/legend "Wat ging er mis?", vijf native radios Onjuist/Onvolledig/Bron klopt niet/Vraag niet begrepen/Anders, optionele toelichting, knoppen Versturen/Annuleren — Versturen geblokkeerd zonder reden, annuleren slaat niets op). Eén oordeel per gebruiker per antwoord: unieke index `(message_id, user_id)` + upsert op de PostgREST-conflict-target overschrijft volledig (omhoog wist reden en toelichting); na herladen is het oordeel per antwoord zichtbaar en wijzigbaar (één query per gesprek via `useMessageFeedback` met react-query-deduplicatie, aria-pressed komt uitsluitend uit de opgeslagen rij). De gespreksbrede feedbackbalk en `useFeedbackInteraction` zijn verwijderd; bestaande gespreksbrede rijen (`message_id IS NULL`) blijven ongemoeid in de database. Antwoordherkomst: `rag-chat` v2 slaat bij elk nieuw assistentbericht `rewritten_query`, `verification` (grounded/confidence/issues) en `latency_ms` op — gegevens die n8n al meelevert en die eerder bij het opslaan verloren gingen. Beheerdersoverzicht `get_feedback_review()` (SECURITY DEFINER, vaste `search_path`, `is_org_admin()`- + `get_user_org_id()`-checks, geen view want bericht-RLS zou hem leeg maken) retourneert alle negatieve antwoordoordelen van de eigen organisatie met reden, toelichting, vraag, antwoord, verificatie, herschreven zoekvraag, responstijd, assistent en datums — databasefunctie zonder UI (buiten scope). Migratie 017: drie nullable berichtkolommen, `message_id`/`reason` (CHECK vijf codes)/`updated_at` (trigger) op feedback_interactions, constraint één-per-gesprek vervalt, INSERT-policy vervangen + UPDATE-policy nieuw (het bericht moet in een gesprek van `auth.uid()` zitten, afgedwongen via de bestaande bericht-RLS).

**Files**: `src/components/chat/AnswerFeedback.tsx`, `src/components/chat/MessageBubble.tsx`, `src/components/chat/MessageList.tsx`, `src/pages/ChatPage.tsx`, `src/hooks/queries.ts`, `src/types/database.types.ts`, `supabase/functions/rag-chat/index.ts`, `supabase/migrations/017_per_answer_feedback.sql`, `tests/e2e/answer-feedback.spec.ts`, `tests/e2e/feedback-seed.ts`

**Gap**: migratie 017 is toegepast op productie (2026-10-20 door Jaap via de Supabase-webUI; REST-controle bevestigt kolommen en functie, anon krijgt een lege set) en `rag-chat` is herdeployd; de frontend-release is dezelfde dag fast-track naar `main` gegaan op eigenaarsinstructie (PR #24 → develop → main; develop-preview overgeslagen om het breekraam te sluiten, zie `decisions/2026-10-20-012-directe-main-release.md`) — het breekraam (oude productiebalk kon geen nieuwe gespreksfeedback opslaan, research.md #13) is daarmee gesloten. Open: real-DB e2e-suite `answer-feedback.spec.ts` (4 scenario's) draait pas met E2E_EMAIL/E2E_PASSWORD in `.env.local` — Jaap heeft (nog) geen testaccount (2026-10-20); admin/member-check van `get_feedback_review()` (T014) en handmatige live-verificatie (quickstart §4) lopen dan mee. F-01/F-10 (Supabase MCP) en F-16/F-17 (Snyk MCP) vereisen een MCP-sessie.

---

### 🧪 Antwoorden leesbaar, controleerbaar en als CONCEPT gemarkeerd (013)

Chatantwoorden renderen via de bestaande `sanitizeMarkdown`-pijplijn (marked + DOMPurify) met echte opmaak — alinea's, opsommingen, vet en tabellen, gestyled via Tailwind-arbitrary-variants op de container (bewust géén `@tailwindcss/typography`); links openen in een nieuw tabblad met `rel="noopener noreferrer"` (bestaande DOMPurify-hook). Gebruikersvragen staan letterlijk in de chat (React-escaping, regeleinden via `whitespace-pre-wrap`) — ingetypte tags zijn zichtbare tekst, geen opmaak; `sanitizeHtml` is uit `src/lib/sanitize.ts` verwijderd. Nieuw `AnswerMeta` onder elk assistentbericht: de CONCEPT-badge ("CONCEPT, door adviseur te accorderen", constitution II), de verificatieregel op basis van `message.verification` — live uit de rag-chat-respons én na herladen genarrowd uit de jsonb-kolom via `parseVerification` (waarschuwing "Dit antwoord is niet volledig onderbouwd door de bronnen." met de gevonden problemen bij `grounded = false` óf `confidence < 0,7`, drempel als benoemde constante `CONFIDENCE_THRESHOLD`; "Gecontroleerd tegen de bronnen" bij een onderbouwd antwoord; géén regel en géén foutmelding zonder verificatiegegevens) — en de bronnen als genummerde knoppen `[1]`, `[2]` met documentnaam. Bronknoppen openen het hergebruikte analyse-`SourcePanel` als zijpaneel (Referentie, Document, letterlijke passage; Locatie verborgen zolang leeg — de enige SourcePanel-wijziging); Escape sluit het paneel en de focus keert terug naar de bronknop, één paneel tegelijk (state in `MessageList`, sluit ook bij gesprekwissel). Score-badges en de uitklapbare bronnenlijst zijn uit de chatweergave verwijderd — nergens percentages meer bij bronnen; `rag-client` kreeg een optioneel `page`-veld bij bronnen klaar voor een toekomstige n8n-locatie. Frontend-only: geen migraties, Edge Function- of dependency-wijzigingen; de Geschiedenis-pagina kreeg alleen de verplichte `role`-doorgeef van de gedeelde `MessageContent`-component.

**Files**: `src/components/chat/AnswerMeta.tsx` (nieuw), `src/components/chat/MessageContent.tsx`, `src/components/chat/MessageBubble.tsx`, `src/components/chat/MessageList.tsx`, `src/pages/ChatPage.tsx`, `src/pages/HistoryPage.tsx` (alleen role-doorgeef), `src/lib/rag-client.ts`, `src/lib/sanitize.ts` (sanitizeHtml verwijderd), `src/components/analysis/SourcePanel.tsx` (Locatie-conditional), `tests/e2e/answer-presentation.spec.ts` (nieuw, 9 gemockte scenario's), `tests/e2e/rag-chat.spec.ts` (bron-assertie bijgewerkt)

**Gap**: de e2e-suite (9 nieuwe scenario's + de bijgewerkte rag-chat-assertie) draait pas echt zodra `E2E_EMAIL`/`E2E_PASSWORD` in `.env.local` staan (2026-10-29: nog afwezig — 18 skipped / 0 failed, zelfde gedocumenteerde staat als 011/012); handmatige live-verificatie volgens `specs/013-readable-verifiable-answers/quickstart.md` §4 open; F-01/F-10 (Supabase MCP) en F-16/F-17 (Snyk MCP) vereisen een MCP-sessie; bron-locaties (paginanummers) verschijnen pas zodra n8n die meelevert (bewust buiten scope van 013).

---

### 🧪 Risico-analyse als eigen pagina, met soepelere invoer (014)

De risico-analyse draait op twee eigen pagina's binnen de app-layout met vaste, uitsluitend id-bevattende adressen (constitution III): `/analyse/new/:assistantId` (formulier + recente analyses) en `/analyse/:runId` (RunCard-status + bij succes het ongewijzigde ResultView met alle CONCEPT-labels, constitution II); het zijpaneel `AnalysisFlow` is verwijderd en de assistentkaart-knop navigeert. Wegnavigeren verliest niets — herladen, browserterug en bladwijzers werken; onbekende of vreemde runs tonen een nette NL-melding zonder inhoud. Klaar-meldingen: `useAnalysisNotifications` (gedeelde recente-runs-query, interval 10 s alléén zolang er wachtrij/bezig-runs zijn — FR-007) telt afgeronde-ongeziene analyses; badge (cijfertext, sr-only-toelichting, WCAG) bij het zijbalkmenu-item Assistenten in beide nav-renders en `document.title` "(n) Darwin" (basis-titel hersteld bij 0 en unmount); "gezien" is een sessionStorage-set met uitsluitend run-id's (max 50, sessiegebonden — constitution III) met initialisatieregel zodat een eerste sessie geen historische afrondingen telt; bekijken van de lijst (`AnalysisNewPage` markeert alle afgeronde rijen) of een run (`AnalysisRunPage` markeert zodra afgerond) reset de telling. Formulier: Klantreferentie bovenaan, adviseurnaam als vaste tekst in de paginakop (invoerveld Adviseur verwijderd), alle kennisbronnen standaard aangevinkt bij een nieuwe analyse (retry herstelt de eerdere keuze) met de nieuwe hulptekst "Standaard zijn alle kennisbronnen van deze assistent geselecteerd.", voorbeeldtekst in het lege vraagstukveld, en slepen-en-neerzetten op het uploadvak (dezelfde controles/meldingen; de knop blijft het toetsenbordalternatief). "Opnieuw" na een mislukte analyse navigeert naar de startpagina met de in-memory retry-snapshot (router-state `{ retryRunId }`, nooit in de URL) plus een `hadBestanden`-vlag die de amber-melding "Bijlagen zijn niet bewaard. Voeg de bestanden opnieuw toe." toont. Recente-lijst: per geslaagde run "beschikbaar tot dd-mm-jjjj" via het nieuwe optionele `expires_at`-veld in `RecentRunSchema` (rollout-veilig — de lijst blijft intact zolang de backend het veld nog niet levert; mock-server levert het; contractnotitie in specs/008-risico-analyse-ui/contracts/run-status.md). Frontend-only: geen migraties, Edge Functions of nieuwe dependencies; de Geschiedenis-pagina onaangeroerd.

**Files**: `src/pages/AnalysisNewPage.tsx` (nieuw), `src/pages/AnalysisRunPage.tsx` (nieuw), `src/pages/AssistantsPage.tsx`, `src/components/layout/AppShell.tsx`, `src/components/analysis/AnalysisForm.tsx`, `src/components/analysis/RecentRunsPanel.tsx`, `src/hooks/useAnalysisNotifications.ts` (nieuw), `src/hooks/useRecentRuns.ts`, `src/store/analysisSeenStore.ts` (nieuw), `src/lib/analysis-retry.ts` (nieuw), `src/lib/analysis-schemas.ts`, `src/App.tsx`, `scripts/mock-analysis-server.mjs`, `specs/008-risico-analyse-ui/contracts/run-status.md` (notitie), `tests/e2e/analysis-notifications.spec.ts` (nieuw), `tests/e2e/analysis-form.spec.ts`, `tests/e2e/analysis-run.spec.ts`, `tests/e2e/analysis-jwt.spec.ts`; verwijderd: `src/components/analysis/AnalysisFlow.tsx`

**Gap**: e2e-suite (8 nieuwe gevallen: navigatie-vast-adres, badge+titel/reset, volgorde/adviseur, standaardselectie, bijlagen-melding ±, vervaldatum, DnD+placeholder) draait pas echt zodra `E2E_EMAIL`/`E2E_PASSWORD` in `.env.local` staan (2026-10-30: 72 skipped / 0 failed); backend-afstemming: `expires_at` toevoegen aan de recente-lijst-items van de echte analyse-API (vrijblijvend — frontend werkt ook zonder); handmatige live-verificatie volgens `specs/014-risk-analysis-page/quickstart.md` §3 open; F-01/F-10 (Supabase MCP) en F-16/F-17 (Snyk MCP) vereisen een MCP-sessie.

---

### 🟡 Pushmeldingen voor afgeronde risico-analyses (018)

Web Push (RFC 8291/8292) met VAPID, zonder Firebase SDK en zonder web app
manifest. In het gebruikersblok onderaan de zijbalk (beide nav-renders) zet de
adviseur meldingen aan voor dit apparaat: de browser vraagt pas om toestemming
na de klik, de status is tekst ("Meldingen staan aan/uit op dit apparaat") met
`aria-live="polite"`, en dezelfde knop zet ze weer uit. Bij geweigerde
toestemming of een browser zonder Push API verschijnt een Nederlandse uitleg
zonder knop; bij een gemiste configuratie of fout een melding met "Opnieuw
proberen". Bij uitloggen verwijdert `authStore.signOut` eerst het abonnement van
dít apparaat (DB-rij + `subscription.unsubscribe()`), daarna de sessie. Nieuwe
tabel `push_subscriptions` (per gebruiker per apparaat, `UNIQUE (user_id,
endpoint)`, CHECKs op https/lengte/niet-lege sleutels) met RLS: alleen eigen
SELECT/INSERT/DELETE, geen UPDATE-policy (aanzetten is delete+insert,
research R5). Nieuwe Edge Function `push-send`: één serverside verzender met
invoer `{user_id, kind, url}` (relatief `/analyse/<uuid>`), `X-Push-Token`,
payload **uitsluitend** `{kind, run_id}`, sequentiële verzending, 404/410 →
abonnement verwijderen, overige fouten → `failed` zonder throw, altijd
`200 {ok,sent,removed,failed}`. Gebruikt `jsr:@negrel/webpush@0.5.0` (Web
Crypto) omdat `npm:web-push` op de Supabase Edge Runtime faalt
(`crypto.createECDH` ontbreekt in Deno). `public/sw.js` toont alleen de vaste
teksten "Uw risico-analyse is gereed"/"Uw risico-analyse is mislukt", `tag` =
run-id (geen dubbele melding), en opent bij klik `/analyse/<run-id>`; géén
fetch-handler, cache of browseropslag. VAPID-secrets `VAPID_KEYS`,
`VAPID_SUBJECT`, `PUSH_SEND_TOKEN`; alleen de publieke sleutel staat als
`VITE_VAPID_PUBLIC_KEY` in de bundel. Send-logica heeft 15 Node-unit tests
(`node --test`); Playwright dekt aanzetten/uitzetten/weigeren/niet-ondersteund
met `permissions: ['notifications']` en een `PushManager`-stub.

**Files**: `supabase/migrations/019_push_subscriptions.sql`,
`supabase/functions/push-send/index.ts`, `supabase/functions/push-send/logic.ts`,
`supabase/functions/push-send/logic.test.ts`, `public/sw.js`,
`src/lib/push/client.ts`, `src/lib/push/types.ts`,
`src/hooks/usePushSubscription.ts`,
`src/components/layout/PushNotificationControl.tsx`,
`src/components/layout/AppShell.tsx`, `src/store/authStore.ts`,
`src/types/database.types.ts`, `src/vite-env.d.ts`,
`scripts/generate-vapid-keys.mjs`, `tests/e2e/push-notifications.spec.ts`,
`tests/e2e/push-stubs.ts`, `specs/018-push-notifications/`

**Gap**: op 2026-10-31 is het serverdeel live gezet: migratie toegepast via
Supabase MCP (RLS `true` + drie policies geverifieerd), `VAPID_KEYS`/
`VAPID_SUBJECT`/`PUSH_SEND_TOKEN` als secrets gezet, en `push-send` gedeployed
(versie 1, ACTIVE, `verify_jwt: false`). De R1-smoke met één synthetische
abonnement-rij gaf `200 {ok:true,sent:0,removed:0,failed:1}` en logs met alleen
`PUSH_SENT`/`SEND_FAILED` — `jsr:@negrel/webpush` werkt dus op de Edge Runtime,
geen fallback nodig. Met een nieuw, apart E2E-lidaccount (role=member,
credentials alleen in `.env.local`) zijn de 5 Playwright-tests groen — inclusief
de echte `push_subscriptions`-ronde en de uitlog-opruiming — en slaagt de
RLS-rooktest (eigen insert, alleen eigen rijen, delete van andermans rij 0
rijen, insert voor een ander `42501`, geen UPDATE-policy); de volledige suite is
18 passed / 68 skipped / 0 failed. `node --test` is 15/15, `tsc --noEmit` en
fitness zijn schoon (0 fail). Nog open: de publieke sleutel in **Netlify**
zetten (`VITE_VAPID_PUBLIC_KEY`; Netlify CLI is niet ingelogd), de handmatige
push-rooktest `quickstart.md` §5 (echte melding bij gereed/mislukt, klik opent
`/analyse/<run-id>`), en een E2E-adminaccount (`E2E_EMAIL`/`E2E_PASSWORD`) zodat
de 68 admin-tests niet meer skippen. `analysis-run-callback` bestaat **niet** in
dit project (geen functie, geen `analysis`-tabel — gate T003 = nee); de
callback-hook staat als contract in `contracts/analysis-callback-integration.md`
en US2 is pas end-to-end actief zodra het analyse-backend die hook uitrolt.
`eslint src/ --max-warnings 0` faalt op 6 bestaande waarschuwingen in
`src/App.tsx`, `src/components/ui/toast.tsx` en `src/lib/posthog.tsx` (niet door
deze feature veroorzaakt).

---

### Platformbeheer — assistentcatalogus, organisatieschakelaars en koppelingen

Eén platformbeheerder beheert de platformbrede assistentcatalogus
(`assistant_catalog`), zet per organisatie assistenten aan of uit en stelt de
centrale n8n-koppeling in (headernaam, write-only secret, documentverwerkings-URL
en per assistent een test- en productie-URL). Kantoorbeheerders koppelen alleen
nog kennisbronnen van hun eigen organisatie; Instellingen is platformbeheerder-only.
`rag-chat` en `document-webhook` lezen de centrale koppeling met de service role;
`create-tenant` autoriseert via `is_platform_admin()` en zaait alle
catalogusassistenten direct aan. De client kan `ai_assistants` niet meer schrijven:
zes policies zijn gedropt (drie uit migratie 015 plus drie verweesde permissieve
policies die alleen in de live database stonden).

**Files**: `supabase/migrations/021_platform_admin_catalog.sql`,
`supabase/functions/platform-admin/index.ts`,
`supabase/functions/rag-chat/index.ts`,
`supabase/functions/document-webhook/index.ts`,
`supabase/functions/create-tenant/index.ts`, `src/lib/platform-admin-client.ts`,
`src/hooks/useAuth.ts`, `src/hooks/queries.ts`,
`src/components/layout/AppShell.tsx`, `src/components/ui/switch.tsx`,
`src/components/settings/ConnectionsDialog.tsx`, `src/pages/SettingsPage.tsx`,
`src/pages/SettingsOrganizationPage.tsx`, `src/pages/AssistantsPage.tsx`,
`src/lib/labels.ts`, `src/App.tsx`, `src/types/database.types.ts`,
`tests/e2e/platform-admin.spec.ts`, `tests/e2e/fixtures.ts`,
`scripts/rls-verify.mjs`, `specs/019-platform-assistant-catalog/`

**Gap**: code, migratie en tests zijn geschreven, maar **niets is toegepast of
gedeployed**. Open: `<PLATFORM_ADMIN_EMAIL>` invullen en de pre-checks uit
quickstart §0 draaien, migratie 021 toepassen, de vier Edge Functions deployen
(`platform-admin`, `rag-chat`, `document-webhook`, `create-tenant`), de frontend
releasen en daarna de gedeployde `flow-config` verwijderen. E2E-platform- en
lidaccount (`E2E_PLATFORM_ADMIN_*`, `E2E_TEST_ORG_NAME`) ontbreken nog, dus de
nieuwe tests skippen. `eslint src/ --max-warnings 0` faalt op dezelfde zes
bestaande waarschuwingen als bij feature 018 (niet door deze feature veroorzaakt).

---

> Dit bestand wordt onderhouden door `@feature-tracker`. Niet handmatig bewerken.

