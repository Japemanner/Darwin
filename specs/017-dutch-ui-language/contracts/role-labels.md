# Contract: role labels (`src/lib/labels.ts`)

**Feature**: 017-dutch-ui-language · **Spec**: FR-005, FR-006, FR-015, SC-003

## Purpose

One source of truth for the Dutch display names of the stored roles. Stored values and
permission logic are untouched.

## Module

New file `src/lib/labels.ts` (TypeScript, English identifiers per Constitution I):

```ts
export const ROLE_LABELS: Record<'admin' | 'member', string> = {
  admin: 'Beheerder',
  member: 'Adviseur',
}

// Returns a Dutch label for the stored value; 'Geen rol' when the value is missing.
export function roleLabel(role: string | null | undefined): string
```

Rules:

- `roleLabel('admin') === 'Beheerder'`
- `roleLabel('member') === 'Adviseur'`
- `roleLabel(null | undefined | '') === 'Geen rol'`
- Unknown values also return `'Geen rol'` (no raw value is ever rendered)
- No side effects, no React import, no data access — a pure map plus a lookup
- Strings are the only UI copy in the module; the map is not exported to the database
  types and does not change `'admin' | 'member'` anywhere

## Consumers (exhaustive)

| File | Usage | Before |
|------|-------|--------|
| `src/components/layout/AppShell.tsx` | desktop user block and mobile drawer user block | `{profile?.role \|\| 'Geen rol'}` / `{profile?.role}` |
| `src/pages/TeamPage.tsx` | member badge, invitation badge, invite role options | `'Admin' : 'Lid'`, `ROLE_OPTIONS` literals |
| `src/pages/SettingsPage.tsx` | tenant role options, success copy (`met admin …`), tenant description | `TENANT_ROLE_OPTIONS` literals, "admin-gebruiker" |

Option arrays are derived per page from `ROLE_LABELS` so each page keeps its current
option order (Team: adviseur first; Settings: beheerder first). Badges keep their
existing `variant` logic (`admin` → `default`, otherwise `secondary`).

## Non-goals

- No change to `src/types/database.types.ts`, no migration, no RLS, no edge function
- No change to how roles are checked (`profile?.role === 'admin'` stays)
- No change to the invitation payload (`role: 'member' | 'admin'`)

## Acceptance checks

- Grep `src/` for rendered `profile?.role` — no direct render remains.
- Grep `src/` for `'Admin'` / `'Lid'` as display strings — none remain (status/badge
  words like "Inactief" are unrelated).
- AppShell, Team and Settings show "Beheerder"/"Adviseur" for the same account.
