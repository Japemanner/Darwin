# OpenCode Prompt System — Supabase + Netlify App

This folder contains the complete OpenCode agent system for building a production front-end app with Supabase and Netlify.

## Files in this package

```
AGENTS.md                          ← Drop in project root. Main instructions for OpenCode.
FEATURES.md                        ← Drop in project root. Auto-maintained feature registry.
REGRESSION.md                      ← Drop in project root. Auto-maintained test history.
FITNESS.md                         ← Drop in project root. Auto-maintained fitness log.
.opencode/agents/feature-tracker.md   ← Sub-agent: documents every feature
.opencode/agents/playwright-tester.md ← Sub-agent: writes and runs Playwright tests
.opencode/agents/fitness-checker.md   ← Sub-agent: architecture fitness checks
```

## How to use

1. Copy all files into the root of your new project, preserving the folder structure.
2. Open OpenCode in your project root.
3. Start building: describe the first feature you want.
4. OpenCode will automatically invoke the three sub-agents after every feature.

## The loop (runs automatically after every feature)

```
Build feature
    → @feature-tracker  → FEATURES.md updated
    → @playwright-tester write → new test added
    → @playwright-tester regress → full suite run → REGRESSION.md updated
    → @fitness-checker → 14 architecture checks → FITNESS.md updated
    → All green? Commit. Move to next feature.
```

## MCPs required

Make sure these MCPs are active in your OpenCode session:
- **Supabase MCP** — for all database, auth, storage, and edge function operations
- **Playwright MCP** — for all test writing and execution

## Environment variables needed

Copy `.env.example` to `.env.local` and fill in:

```
VITE_SUPABASE_URL=https://[project-ref].supabase.co
VITE_SUPABASE_ANON_KEY=[your-anon-key]
TEST_USER_EMAIL=[test-account-email]
TEST_USER_PASSWORD=[test-account-password]
PLAYWRIGHT_BASE_URL=http://localhost:5173
```
