# FEATURES.md — Application Feature Registry

_Last updated: 2026-10-15_
_Total features: 19_

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

### 🧪 AI Chat — Gesprek met Assistent

Slide-out chat panel per assistent. Laadt of maakt een conversatie, stuurt berichten naar N8N webhook, toont antwoord. Alle berichten worden opgeslagen in de database.

**Files**: `src/pages/AssistantsPage.tsx` (ChatWindow component)

**Gap**: Geen retry bij gefaalde webhook, geen webhook validatie bij opslaan assistent.

---

### ✅ Kennisbronnen — Volledig CRUD (admin-only)

Kennisbronnen aanmaken, bewerken, bekijken. Velden: naam, beschrijving. Per organisatie gescoped. Sinds feature 010 admin-only: members zien bronnen, documenten en statussen alleen-lezen (KBSlideOver zonder upload/bewerk/verwijderbesturing).

**Files**: `src/pages/KnowledgePage.tsx` (grid + KBMappingModal)

---

### 🧪 Document Upload & Beheer — Supabase Storage + N8N Webhook

Documenten (PDF/TXT/DOCX) uploaden naar Supabase Storage, DB-record aanmaken met status `processing`, gesigneerde download URL (15 min) genereren, N8N webhook versturen met `{ tenant_id, document_name, document_type, download_url }`. Verwijderen uit storage + DB.

**Files**: `src/lib/storage.ts`, `src/pages/KnowledgePage.tsx` (KBSlideOver)

**Gap**: Document status wordt door N8N bijgewerkt (processing→ready→error) — geen client-side polling.

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

**Gap**: Playwright-tests (XSS-preventie, visuele-identiek check) nog te schrijven — tests/ directory ontbreekt.

---

### 🧪 Risico-analyse assistent UI (008)

Chat-stijl vaste flow voor het nieuwe assistent-type `risico_analyse` (geen vrije chat): invoerformulier (Verzekeringsvraagstuk, Kennisbronnen multi-select, Klantsituatie, Bestanden pdf/docx/txt met limieten zichtbaar, https-only URL's, Klantreferentie, Adviseur prefilled) met groepsvalidatie; asynchrone run met statuskaart (in wachtrij/bezig/klaar/mislukt, elapsed time, polling 3s met backoff); resultatenweergave met gaps-checklist "Ontbrekende informatie voor het gesprek", interne analyse als gesanitiseerde markdown (marked naar DOMPurify, geen raw HTML), klikbare bronverwijzingen (K/R/A) met zijpaneel (document, locatie, passage), .docx-download met label "CONCEPT, door adviseur te accorderen", copy-to-clipboard, bewaartermijn-melding (7 dagen); foutafhandeling met foutcode en retry-prefill (in-memory, geen browseropslag van klantinhoud). Mock-first: run-flow tegen `scripts/mock-analysis-server.mjs` via `VITE_ANALYSIS_API_URL`; echte backend gecontracteerd in `specs/008-risico-analyse-ui/contracts/`. De client stuurt sinds feature 009 het sessie-JWT mee op alle drie de calls.

**Files**: `src/components/analysis/*`, `src/lib/analysis-client.ts`, `src/lib/analysis-schemas.ts`, `src/hooks/useAnalysisRun.ts`, `src/hooks/useRecentRuns.ts`, `src/lib/sanitize.ts`, `scripts/mock-analysis-server.mjs`, `tests/e2e/analysis-form.spec.ts`, `tests/e2e/analysis-run.spec.ts`, `tests/e2e/analysis-jwt.spec.ts`, `playwright.config.ts`

**Gap**: E2E-suite vereist testaccount (E2E_EMAIL/E2E_PASSWORD); draait verder tegen de mock server.

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

> Dit bestand wordt onderhouden door `@feature-tracker`. Niet handmatig bewerken.

