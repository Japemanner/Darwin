# Data Model: Eenduidige Nederlandse UI-taal en navigatie

This feature has no persisted data and no database change. The "entities" below are the
conceptual records the design and the inventory work with; all are compile-time or
documentation artifacts.

## UI copy entry

One row in `specs/017-dutch-ui-language/copy-inventory.md`.

| Field | Type | Rules |
|-------|------|-------|
| `#` | integer | Sequential, stable across review rounds |
| `bestand` | path | Repo-relative path of the file that owns the string (e.g. `src/pages/HistoryPage.tsx`) |
| `scherm/onderdeel` | text | Where the user sees it (page, dialog, toast, empty state, aria-label) |
| `oud` | text | Exact current string, including punctuation and inline markup placeholders (`<strong>{naam}</strong>` kept as `{naam}`) |
| `nieuw` | text | Proposed Dutch "u"-form string; must satisfy the copy rules in `contracts/ui-copy.md` |

Validation rules derived from the spec:

- **FR-001/FR-002**: `nieuw` is Dutch and contains no `je`, `jij`, `jouw`, `jullie`,
  `jezelf` (checked as whole words, case-insensitive).
- **FR-003/FR-004**: `nieuw` contains no English word outside the allowlist
  (Darwin, n8n, AI, webhook, URL, token, CORS, header, PDF, DOCX) or a literal n8n
  interface label.
- **FR-010**: every changed visible string appears in the rows — labels, placeholders,
  aria-labels, titles, toasts, dialog copy, empty states, error and status text.
- **FR-015**: the same concept uses the same term everywhere; the terminology table in
  `contracts/ui-copy.md` is authoritative.
- Coverage: a file is listed either with rows or in the "reviewed, unchanged" list; no
  file may be silently absent.

## Role label

In-memory mapping in `src/lib/labels.ts`; not persisted.

| Field | Type | Rules |
|-------|------|-------|
| `stored value` | `'admin' \| 'member'` | Unchanged; comes from `profiles.role`, `invitations.role` and edge-function payloads |
| `display label` | string | `admin` → `Beheerder`, `member` → `Adviseur` |
| fallback | string | Missing/unknown value → `Geen rol` (never an empty string, never a raw English value) |

Invariants:

- `database.types.ts` is not edited; no migration, no RLS change.
- Payload keys and values sent to Supabase/Edge Functions keep `admin` / `member`.
- Display-only: the map is used for badges, the sidebar user block and select options.

## Navigation entry

Conceptual entry in the sidebar; configuration is the `navItems` array plus the bottom
user block in `src/components/layout/AppShell.tsx`.

| Field | Type | Rules |
|-------|------|-------|
| `label` | string | Visible Dutch text: `Overzicht`, `Assistenten`, `Kennisbronnen`, `Geschiedenis`, `Team`, `Instellingen`, and the user-block link `Ideeën en wensen` |
| `href` | route | Unchanged targets; the ideas entry keeps `/roadmap` |
| `position` | `'main' \| 'user-block'` | `Ideeën en wensen` is `user-block`; every other entry is `main` |
| `visibility` | role predicate | Unchanged: `Team` and `Instellingen` require the `admin` role; the ideas link is visible to all authenticated users |
| `icon` | component | Existing lucide icon, rendered `aria-hidden`; the label carries the accessible name |

Invariants:

- The route list in `src/App.tsx` is unchanged; `/roadmap` remains reachable directly.
- Main-nav ordering is unchanged apart from the removed roadmap entry.
- Both sidebar variants (mobile drawer, desktop `aside`) carry the same entries with the
  same labels and the same position.

## State transitions

None. No state machine, cache key, query, or local-storage key changes. The only runtime
difference is the position of a static link in the rendered sidebar.
