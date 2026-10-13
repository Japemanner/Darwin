# Research: 009-secure-n8n-proxy

**Date**: 2026-10-13 | **Feature**: [spec.md](spec.md)

Facts only, collected from the codebase. All paths relative to the repo root.

## 1. Current browser → n8n flows

All webhook logic lives in `src/lib/webhook.ts` (449 lines). Importers:
`src/pages/AssistantsPage.tsx:4`, `src/lib/storage.ts:2`,
`src/pages/SettingsPage.tsx:4,15`.

| Function | Defined | Call sites | Error surfacing |
|---|---|---|---|
| `callRagWebhook` | webhook.ts:206-304 | AssistantsPage.tsx:473 (`ChatWindow.handleSend`, inside `Promise.all` with the `messages` insert) | Dutch messages from `classifyWebhookError` (webhook.ts:120-137) + timeout/CORS texts (webhook.ts:294-299), shown as destructive toast (AssistantsPage.tsx:501-514) |
| `callDocumentWebhook` | webhook.ts:392-449 | storage.ts:44-53 (upload), storage.ts:81 (delete) | **None** — swallowed via `console.error` (webhook.ts:438-448). UI toasts only cover the storage/DB operations |
| `testWebhook` | webhook.ts:306-388 | SettingsPage.tsx:112 (`FlowConfigCard.handleTest`) | Inline result box + toast (SettingsPage.tsx:113-119, 211-216) |
| `encryptToken` | webhook.ts:64-73 | SettingsPage.tsx:70 (client-side AES-256-GCM, key from `VITE_ENCRYPTION_KEY` via `getEncryptionKey` webhook.ts:57-62) | — |
| `decryptToken` | webhook.ts:75-83 | SettingsPage.tsx:109 (test with stored token), webhook.ts:232 (chat), webhook.ts:414 (documents) | — |
| `invalidateAssistantKBCache` | webhook.ts:178-184 | **None** — dead code; the module-level `kbCache` (webhook.ts:156) is never invalidated | — |

Client-side responsibilities that must move server-side:
- `tenantId` = `organizations.name`, fetched in the browser (webhook.ts:247-250 chat;
  webhook.ts:406-412 documents); fallback `organizationId`.
- Knowledge bases via `assistant_knowledge_bases` join, module-cached
  (webhook.ts:158-176).
- History: last 20 messages from `messages` (webhook.ts:186-196).
- `knowledgeSourceName` = names joined with `", "` (webhook.ts:252) — the cause of
  the "twee kennisbronnen vindt niets" bug (n8n Qdrant filter matches the joined
  string against a single `metadata.kennisbron`).
- Response normalization `extractWebhookResponse` (webhook.ts:89-118): handles
  array/object shapes, `answer`/`response` legacy fields, falls back to
  `"Geen antwoord ontvangen"`.
- Fallback: when no `rag_chat` flow config (or empty URL), `callRagWebhook` uses
  `assistant.n8n_webhook_url` without token, header `X-Webhook-Token`
  (webhook.ts:218-238). Per-assistant URL column exists on `ai_assistants` and
  is editable in AssistantModal (AssistantsPage.tsx:171,184,218,291-293).
- Timeouts: chat 30 s (webhook.ts:275), document 10 s (webhook.ts:419),
  test 10 s (webhook.ts:322).

## 2. `flow_configs`: schema, RLS, UI

Schema (migrations 002/005/006):
`id, flow_type ('rag_chat'|'document_processing', UNIQUE with organization_id),
webhook_url NOT NULL, webhook_token TEXT NOT NULL DEFAULT '' (hex AES-GCM
ciphertext today), webhook_auth_header TEXT NOT NULL DEFAULT 'X-Webhook-Token',
organization_id FK, created_at, updated_at`.

RLS (002:43-68, enabled; table-level, **no column restrictions**):
- SELECT: "Anyone in org can view flow configs" (`organization_id = get_user_org_id()`)
  — every org member, member or admin, can read `webhook_token` today.
- INSERT/UPDATE/DELETE: admins only (`profiles.role = 'admin'` + org match).
- `get_user_org_id()` is `STABLE SECURITY DEFINER` (001:171-174).

Type: `FlowConfig` alias in database.types.ts:339-372,527.

Settings UI (`FlowConfigCard`, SettingsPage.tsx:26-221, rendered per flow type at
392-406): fields webhook URL (150-167), auth header name (170-180), token
(`type="password"`, 183-196, placeholder "laat leeg om huidige token te
behouden"). `handleSave` (63-94) encrypts a typed token client-side or re-saves
the existing ciphertext; `useSaveFlowConfig` (queries.ts:619-660) does PostgREST
update/insert. `useFlowConfig` (queries.ts:282-297) selects `*` — the ciphertext
reaches the browser on every load. The token value is never displayed and the
form hydrates only URL + header (SettingsPage.tsx:53-61), but `handleTest`
decrypts the stored token in the browser (SettingsPage.tsx:109).

## 3. Document upload/delete flow

`src/lib/storage.ts` (82 lines), called from `KnowledgePage.tsx`
(upload 218-241, delete 243-251; extensions pdf/txt/docx):

- `uploadDocument` (5-56): uploads to private bucket `knowledge-documents`
  (path `${organizationId}/${knowledgeBaseId}/${uuid}.${ext}`, 15-17), inserts
  row `knowledge_base_documents` with status `processing` (21-34), creates a
  **signed URL, 900 s** client-side (38-40), then `callDocumentWebhook` (44-53).
- `deleteDocument` (58-82): removes file first (66-68), deletes row (73-76),
  then `callDocumentWebhook` with `downloadUrl: ''` (81). Row deletion before
  notify means a server-side reader cannot load the document after the fact.

Server-side org checks that already exist: storage bucket policies on
`storage.objects` require first path segment = org id (007:83-121);
`knowledge_base_documents` RLS is org-scoped (007:217-227). The webhook payload
itself is built from browser data with no server check.

## 4. Existing Edge Function house pattern

Three functions exist: `create-tenant`, `invite-user`, `send-feature-request`
(each a single `index.ts`, no shared modules). Common pattern:

- Secrets via `Deno.env.get`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
  (naming with `_KEY` suffix), plus function-specific (`RESEND_API_KEY`).
- Auth: manual `Authorization` header parse + `supabase.auth.getUser(token)`
  on a service-role client; 401 JSON `{"error": "..."}` on failure; role checks
  by reading `profiles` (e.g. admin check in create-tenant:68-79).
- CORS: hardcoded wildcard `*` (to be replaced by `ALLOWED_ORIGINS` for the new
  functions per the technical route).
- Errors: JSON `{ "error": string }`, English messages, `console.error` only.
- Client invocation: `supabase.functions.invoke()` (auto-attaches session JWT)
  in SettingsPage.tsx:244 and TeamPage.tsx:181; raw fetch with explicit
  `Bearer` in RoadmapPage.tsx:221-241.
- Deployment: manual via Supabase CLI (README:50-53) or Supabase MCP
  (AGENTS.md; `opencode.json` pins `SUPABASE_PROJECT_REF`). No CI touches
  `supabase/functions/`; `supabase/config.toml` does not exist.

## 5. Analysis client and 008 contracts

`src/lib/analysis-client.ts` (210 lines) targets `VITE_ANALYSIS_API_URL`
(mock server, dev port 4010) on all three calls — `submitAnalysisRun`
(POST, 30 s), `fetchAnalysisRun` (GET), `fetchRecentRuns` (GET) — **without any
Authorization header**, contradicting specs/008-risico-analyse-ui/contracts:
`n8n-submit.md:7-9` ("aangeroepen door de UI met het Supabase JWT") and
`run-status.md:12` ("met Supabase JWT"). Error mapping and Dutch texts already
exist (`AnalysisClientError` with codes incl. `UNAUTHORIZED`, `BACKEND_TIMEOUT`).
The mock server advertises `Authorization` in its CORS allow-headers but never
validates it (mock-analysis-server.mjs:207-226), so adding the header is
backward-safe for all existing e2e tests.

None of the contracted analysis backend pieces (edge functions, `analysis_runs`
table) exist yet — out of scope for this feature; only the JWT header is added.

## 6. Test conventions

- Playwright config (playwright.config.ts): `tests/e2e/`, baseURL
  `localhost:5173`, auto-starts `node scripts/mock-analysis-server.mjs` (port
  4010, `MOCK_SCENARIO`) and `npm run dev`; `reuseExistingServer: true`.
- Auth is real (PKCE login via `tests/e2e/fixtures.ts` with
  `E2E_EMAIL`/`E2E_PASSWORD`, skip-with-reason when unset). One test account.
- Locators are Dutch label/role/text based; no data-testid convention.
- The `page.route('**/functions/v1/<name>')` interception pattern is the
  planned approach for mocking the new edge functions (per technical route).

## 7. Environment & secrets inventory

- Client env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
  `VITE_ENCRYPTION_KEY` (webhook.ts:58, declared vite-env.d.ts:6, example value
  .env.example:3), `VITE_ANALYSIS_API_URL`, PostHog vars. Production set in
  Netlify dashboard.
- Edge env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (+ new
  `ALLOWED_ORIGINS`, and `SUPABASE_ANON_KEY` for the user-context client).
- Guard rails: fitness checks F-02 (no service_role in src/), F-09 (no
  auth.admin/service-role createClient in src/), F-12 (.env.local gitignored),
  gitleaks in pre-commit. Next free fitness check number: **F-18**.

## 8. Prior decisions (authoritative for this feature)

- `docs/verbeterplan-opencode.md` groep A (A2, lines 101-149) is the technical
  route: three edge functions (`rag-chat`, `document-webhook`, `flow-config`),
  RLS-preserving reads with a user-context client + service-role reads for
  `flow_configs`, error JSON `{ code, message }` with codes `UNAUTHORIZED,
  FORBIDDEN, NOT_CONFIGURED, UPSTREAM_AUTH, UPSTREAM_ERROR, UPSTREAM_TIMEOUT,
  UPSTREAM_UNREACHABLE`, 60 s n8n fetch timeout, `knowledge_sources: string[]`
  plus legacy `knowledgeSourceName`, plaintext token storage (write-only),
  migration with REVOKE/GRANT + token wipe, `ALLOWED_ORIGINS` CORS, fitness
  check, Playwright with `page.route`, quickstart with release order:
  **functions → frontend (main) → REVOKE-migratie** (single production Supabase
  project; old frontend reads `flow_configs` with `*`).
- n8n side (not via OpenCode): N1 — after this feature n8n switches its Qdrant
  filter to the `knowledge_sources` list; N5 — new token in the n8n credential
  "Darwin auth".
- `specs/002-rag-assistant-management/contracts/webhook-contract.md` defines
  the base n8n payload (`assistant`, `knowledge_bases`, `conversation`,
  `message`; 20-message truncation; empty `knowledge_bases` = prompt-only
  answer; legacy `response` field support). Feature 009 adds server-side
  resolution and the `knowledge_sources` list on top.

## 9. Risks & observations for planning

- **Release order is a hard constraint**: applying REVOKE before the new
  frontend is live breaks chat for every user (old bundle selects `*`).
- The token wipe in the migration invalidates re-entered tokens if applied
  after org admins already saved new ones — the quickstart must sequence
  wipe-migration *before* per-org token re-entry.
- Untracked local file `supabase/migrations/012_link_existing_user_to_darwin.sql`
  exists in the work tree; the next free migration number is **014**
  (013_risico_analyse_type.sql is committed).
- `deleteDocument` currently deletes row+file before notifying n8n; a
  server-side reader needs the row to exist, so the client flow must notify
  first (also required by spec US2 scenario 3: on failure the document stays).
- Score badge in the chat UI renders `source.score` as a percentage
  (AssistantsPage.tsx:623-635) — the new edge function response must keep
  passing `score` through until feature F replaces the UI.
- `is_active` exists on assistants and is part of the verbeterplan's rag-chat
  validation ("zelfde organisatie, actief").