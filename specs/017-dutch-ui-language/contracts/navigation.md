# Contract: sidebar navigation

**Feature**: 017-dutch-ui-language · **Spec**: US3, FR-007, FR-008, FR-009, SC-004

## Main navigation (after)

| Order | Label | Target | Visibility | Change |
|-------|-------|--------|------------|--------|
| 1 | Overzicht | `/command-center` | all authenticated users | label changed (was "Command Center") |
| 2 | Assistenten | `/assistants` | all | unchanged |
| 3 | Kennisbronnen | `/knowledge` | all | unchanged |
| 4 | Geschiedenis | `/history` | all | unchanged |
| 5 | Team | `/team` | beheerders | unchanged |
| 6 | Instellingen | `/settings` | beheerders | unchanged |

The Roadmap entry is removed from this list. Its route and page stay registered in
`src/App.tsx`; `/roadmap` remains directly reachable.

## User block (bottom of the sidebar)

```text
┌ aside (w-64) ─────────────
│ nav: Overzicht … Instellingen
│ ─────────────── (existing border-t)
│ [Map] Ideeën en wensen        ← new link, all users, above the identity row
│ (avatar) Naam                 ← existing
│          Beheerder|Adviseur   ← via roleLabel()
│ (sign-out icon button)        ← existing
└────────────────────────────
```

Rules:

- The link is a real `<Link to="/roadmap">` with visible text `Ideeën en wensen`; the
  `Map` icon is `aria-hidden="true"`, so the accessible name is the label.
- It sits inside the bottom block, outside `<nav>`; the main-nav active-state logic does
  not apply to it (no new active state).
- Same markup and order in the mobile drawer and the desktop `aside`.
- No query string, no state, no analytics event, no sessionStorage — the href is static.
- Label fits the 256px column at `text-sm` without truncation (18 characters).
- Keyboard order: nav links first, then the ideas link, then the identity row and the
  sign-out button.

## Page

| Aspect | Rule |
|--------|------|
| Heading | `Ideeën en wensen` (matches the nav label) |
| Route | `/roadmap` — unchanged |
| Visibility | unchanged (all authenticated users) |
| Content | unchanged except Dutch copy from the approved inventory |
| Dialog | `Idee of wens indienen`; submit toasts in Dutch ("Verzoek verzonden") |

## Non-goals

- No route rename, redirect or history entry change.
- No change to `navItems` filtering other than removing the roadmap item.
- No new component extraction or shared sidebar refactor.

## Acceptance checks

- Desktop and mobile: no `Roadmap` in the main nav; `Ideeën en wensen` visible in the
  user block.
- Clicking the link lands on `/roadmap` and shows the `Ideeën en wensen` heading.
- A member account still sees the same six-item structure minus Team/Instellingen, with
  the ideas link in the user block.
