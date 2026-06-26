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

## Agent Tooling Rules

### 🖊️ Always-On (active while you type)
These run continuously — no manual trigger needed. Always on.

| Tool                   | Why always on                                                                 |
|------------------------|------------------------------------------------------------------------------|
| **Context7 MCP**       | Fetches live docs for every library call. Without this, you're coding from outdated training data. |
| **Supabase MCP**       | Every table, policy, bucket, or edge function goes through the real DB — never guessed from memory. |
| **Sequential Thinking MCP** | Used before any architecture choice or complex decision. Prevents picking solutions without considering alternatives. |
| **TypeScript (IDE)**   | Real-time type feedback — catches hallucinated properties immediately.       |
| **ESLint (IDE)**       | Catches unsafe patterns inline, not at commit time.                          |

### Context7 MCP (Anti-Hallucination — 🔴 Priority 1)
- Always use Context7 MCP when generating code that uses any library or framework.
- Never write Supabase, React, Tailwind, Vite, or TypeScript code without fetching current docs via Context7 first.
- Use library ID `/supabase/supabase` for all Supabase API calls.
- Use library ID `/tailwindlabs/tailwindcss` for Tailwind classes.
- Use library ID `/facebook/react` for React hooks and patterns.
- Start with `resolve-library-id`, then `query-docs` with the full question — never single words.

### GitHub MCP
- Read and search actual repository files — never rely on memory or cached code.
- Open issues, create PRs, and comment on code all from the same chat session.
- Verify file contents by reading directly from GitHub, not from local assumptions.

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

## 🔒 Pre-Commit Hook (automatic on `git commit`)

The `.git/hooks/pre-commit` hook runs these checks on every commit. Must complete in ~10 seconds.

| Check                    | What it does                                              | Blocks commit? |
|--------------------------|-----------------------------------------------------------|----------------|
| `tsc --noEmit`           | TypeScript compiles without errors                        | ✅ Yes         |
| `bash scripts/fitness-check.sh` | Runs all grep/file checks (F-02, F-03, F-04, F-05, F-06, F-08, F-09, F-11, F-12, F-13, F-14, F-15) | ✅ Yes on FAIL |
| Gitleaks                 | Secret scanning — no keys in the commit                   | ✅ Yes         |
| ESLint                   | `npx eslint src/ --max-warnings 0`                        | ✅ Yes         |

**Not in pre-commit hook (too slow / needs live connection):**
- F-01 (RLS) and F-10 (Storage bucket policies) — run via `@fitness-checker` after each feature using Supabase MCP.
- F-16 (Snyk SAST) and F-17 (Snyk SCA) — run via `@fitness-checker` after each feature using Snyk MCP.

### Gitleaks (🔴 Mandatory)
- Detects secrets in the working tree before every commit.
- If secrets are found, the commit is blocked. Never bypass this hook.
- Fix: rotate the exposed secret immediately, then commit again.

---

## 🚀 After Every Feature (not every commit)

Heavier checks — runs deliberately after a completed feature, not on every small commit.

| Step | Tool                        | What it does                                |
|------|-----------------------------|---------------------------------------------|
| 1    | `tsc --noEmit`              | TypeScript compiles without errors          |
| 2    | `@feature-tracker`          | Update FEATURES.md with the new feature     |
| 3    | Playwright MCP (write)      | Write new test(s) for this feature          |
| 4    | Playwright MCP (regression) | Run the full test suite                     |
| 5    | `@fitness-checker`          | Run `scripts/fitness-check.sh`, then Supabase MCP (F-01 RLS + F-10 buckets), then Snyk MCP (F-16 SAST + F-17 SCA). Write FITNESS.md. |
| 6    | All checks green → commit with conventional message |                                              |

**Do not proceed to the next feature until all steps pass.**

---

## Mandatory Workflow — After Every Bug Fix

```
[ ] 1. Root cause documented in commit message
[ ] 2. Invoke @playwright-tester → add regression test for the bug
[ ] 3. Invoke @playwright-tester → run full regression suite
[ ] 4. All tests green? Commit.
```

---

## ☁️ CI/CD (on push to main/develop)

Runs in Netlify or GitHub Actions — not locally.

| Tool                   | Why in CI and not locally                                      |
|------------------------|----------------------------------------------------------------|
| Playwright full suite  | Runs against the Netlify preview deploy, not localhost         |
| Snyk full scan         | Full scan including IaC check on `netlify.toml` + Supabase config |
| SonarQube              | Code quality gate over the entire codebase — too heavy for local |

---

## Security Tools Summary

### Snyk MCP (🔴 Mandatory for security)
- Run `snyk_code_scan` on `src/` after every feature (SAST — OWASP Top 10 in React/TypeScript).
- Run `snyk_sca_scan` on `package.json` after adding dependencies (SCA — CVE scanning).
- Run `snyk_iac_scan` on `netlify.toml` and Supabase config after infrastructure changes.
- Configured in `opencode.json` with `SNYK_API_KEY` from `.env.local`.

### SonarQube MCP (🟡 Optional)
- Code quality gates: bugs, code smells, duplication, test coverage, maintainability.
- Configured separately — enable for additional quality layer beyond Snyk.
- Runs in CI only — too heavy for local.

---

## Branching Strategy — Develop &rarr; Main

> **Ijzeren regel:** elke wijziging gaat eerst naar `develop`, wordt daar getest, en pas daarna naar `main` gemerged.

### Branches

| Branch      | Doel                                  | Wie pushed             |
|-------------|---------------------------------------|------------------------|
| `develop`   | Actieve ontwikkeling &amp; testen      | Iedereen (via PR)      |
| `main`      | Productie — alleen via PR vanuit develop | Maintainer (na testing) |

### Workflow

1. **Branch vanaf `develop`** voor elke feature/fix:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feat/<scope>-<korte-beschrijving>
   ```
2. **Commit &amp; push** naar je feature-branch, open een PR naar `develop`
3. **Test op `develop`** — de Netlify preview-deploy (of lokaal) moet groen zijn:
   - `npx tsc --noEmit` slaagt
   - `npm run build` slaagt
   - Pre-commit hook (fitness checks + gitleaks) groen
   - Happy-path handmatig getest in browser
4. **Merge naar `main`** via PR van `develop` &rarr; `main` — alleen nadat develop getest is
5. **Direct committen op `main` is verboden** — altijd via develop

### Wat als er een hotfix nodig is?

1. Branch `hotfix/<scope>-<beschrijving>` vanaf `main`
2. Fix, test, commit
3. PR naar zowel `main` als `develop` (zodat develop de fix ook heeft)

### Netlify deploy branches

Configureer in Netlify dashboard:
- `main` &rarr; productie-deploy
- `develop` &rarr; preview-deploy (geen publicatie, alleen voor testen)

### Samenvattend

```
feature-branch → develop (testen) → main (productie)
hotfix-branch → main + develop (parallel)
```

**NOOIT** direct naar `main` committen of pushen.

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

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->
