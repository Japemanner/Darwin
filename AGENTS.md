# AGENTS.md — Project Master Instructions

## Project Identity

You are building a **production-grade front-end application** deployed on **Netlify**, integrated with the full **Supabase platform** (Auth, Storage, Edge Functions, Database). All Supabase operations go through the **Supabase MCP**. Testing is handled by the **Playwright MCP**.

This file is the single source of truth for every agent. Read it completely before taking any action.

---

## Technology Stack

| Layer              | Technology                              |
|--------------------|----------------------------------------|
| Frontend           | React 18 + TypeScript + Vite           |
| Styling            | Tailwind CSS v3 + shadcn/ui            |
| Auth               | Supabase Auth (JWT, PKCE flow)         |
| Database           | Supabase PostgreSQL (RLS enabled)      |
| File Storage       | Supabase Storage (Blob / buckets)      |
| Backend logic      | Supabase Edge Functions (Deno/TS)      |
| Deployment         | Netlify (via `netlify.toml`)           |
| Supabase interface | Supabase MCP                           |
| Testing            | Playwright MCP                         |
| State management   | Zustand                                |
| API client         | `@supabase/supabase-js` v2             |

---

## MCP Tooling Rules

### Supabase MCP
- ALL database schema changes go through the Supabase MCP — never raw SQL in migrations unless MCP is unavailable.
- Use the MCP to: create tables, add RLS policies, create storage buckets, deploy edge functions, manage secrets.
- Always verify via MCP that RLS is enabled before shipping any table.

### Playwright MCP
- ALL tests are written through the Playwright MCP.
- Never write Playwright tests by hand — invoke the Playwright MCP agent.
- After every new test run, invoke `@playwright-tester` to execute the regression suite.

---

## Non-Negotiable Architecture Rules

1. **RLS on every table.** No exceptions. If a table exists without RLS, stop and fix it before continuing.
2. **No secrets in client code.** `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are the only Supabase values allowed in the frontend bundle. Service role keys live exclusively in Edge Functions and Netlify environment variables.
3. **Edge Functions for privileged operations.** Any operation requiring the service role key (admin actions, webhooks, payment processing) must live in a Supabase Edge Function, not in the client.
4. **PKCE auth flow.** Use `flowType: 'pkce'` in the Supabase client. No implicit flow.
5. **Netlify redirects for SPA.** `netlify.toml` must include `[[redirects]] from = "/*" to = "/index.html" status = 200`.
6. **Storage bucket policies.** Every bucket must have explicit policies. No public buckets unless explicitly justified in a comment in `FEATURES.md`.
7. **TypeScript strict mode.** `"strict": true` in `tsconfig.json`. No `any` types without a `// @ts-expect-error` comment explaining why.

---

## Mandatory Workflow — After Every Feature

After completing any feature (however small), you MUST execute this checklist **in order**:

```
[ ] 1. Code compiles without TypeScript errors (`tsc --noEmit`)
[ ] 2. Invoke @feature-tracker → update FEATURES.md with the new feature
[ ] 3. Invoke @playwright-tester → write test(s) for the new feature
[ ] 4. Invoke @playwright-tester → run full regression suite
[ ] 5. Run `bash scripts/fitness-check.sh` → then invoke @fitness-checker to read its JSON output and run Supabase MCP + Snyk checks on top
[ ] 6. All checks green? Commit with conventional commit message.
```

**Do not proceed to the next feature until all five steps pass.**

---

## Mandatory Workflow — After Every Bug Fix

```
[ ] 1. Root cause documented in commit message
[ ] 2. Invoke @playwright-tester → add regression test for the bug
[ ] 3. Invoke @playwright-tester → run full regression suite
[ ] 4. All tests green? Commit.
```

---

## Commit Convention

```
feat(scope): short description        # new feature
fix(scope): short description         # bug fix
test(scope): short description        # test only
chore(scope): short description       # tooling / config
refactor(scope): short description    # no behavior change
```

Scope examples: `auth`, `storage`, `edge`, `db`, `ui`, `deploy`, `test`

---

## File & Folder Structure

```
/
├── AGENTS.md                         ← you are here
├── FEATURES.md                       ← auto-maintained by @feature-tracker
├── FITNESS.md                        ← auto-maintained by @fitness-checker
├── netlify.toml
├── .env.local                        ← gitignored
├── .env.example                      ← committed, no real values
├── src/
│   ├── lib/
│   │   ├── supabase.ts               ← single Supabase client instance
│   │   └── storage.ts                ← storage helper functions
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   └── useStorage.ts
│   ├── store/
│   │   └── authStore.ts              ← Zustand auth store
│   ├── components/
│   │   ├── auth/
│   │   ├── storage/
│   │   └── ui/                       ← shadcn components
│   ├── pages/
│   ├── edge-functions/               ← mirrored for local dev reference
│   └── types/
│       └── database.types.ts         ← generated from Supabase CLI
├── supabase/
│   ├── functions/                    ← Edge Functions (deployed via MCP)
│   ├── migrations/                   ← SQL migrations (generated via MCP)
│   └── config.toml
├── tests/
│   ├── e2e/                          ← Playwright tests
│   └── fixtures/
└── .opencode/
    └── agents/
        ├── feature-tracker.md
        ├── playwright-tester.md
        └── fitness-checker.md
```

---

## Supabase Client Initialization (canonical)

The file `src/lib/supabase.ts` must always look like this:

```typescript
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'pkce',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})
```

Never create a second Supabase client instance anywhere else in the app.

---

## Netlify Configuration (canonical)

`netlify.toml` must always contain at minimum:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[build.environment]
  NODE_VERSION = "20"
```

Supabase secrets (service role key, etc.) are set via Netlify environment variables — never in `netlify.toml`.

---

## Definition of Done

A feature is **Done** when:
- [ ] It functions correctly in the browser
- [ ] TypeScript compiles cleanly
- [ ] FEATURES.md is updated
- [ ] At least one Playwright test covers the happy path
- [ ] Regression suite passes
- [ ] Fitness check passes
- [ ] Committed with a conventional commit message
