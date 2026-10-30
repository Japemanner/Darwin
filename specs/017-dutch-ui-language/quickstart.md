# Quickstart: Eenduidige Nederlandse UI-taal en navigatie

Run from the repository root (`C:\Users\jaap\stack\8. Claude Code\7 Darwin`).

## 0. Prerequisites

- `node_modules` installed (`npm install` — no new packages are added by this feature)
- `.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- For the Playwright runs: `E2E_EMAIL` / `E2E_PASSWORD` (beheerder) and
  `E2E_MEMBER_EMAIL` / `E2E_MEMBER_PASSWORD` (adviseur). Without them the specs skip
  with an explicit reason.

## 1. Inventory and approval (blocking)

The inventory is **prepared**: `specs/017-dutch-ui-language/copy-inventory.md`
(status Concept, 93 rows, 13 files). Review it with Jaap:

- walk the table per file and confirm each `nieuw` string;
- resolve the three open points in the inventory ("Chat", technical notation, literal
  n8n labels);
- on approval, set the status to `Approved` with the date and approver.

Only after that, edit `src/`. Re-verify coverage with the searches below before editing
(they also catch strings added since the inventory was written):

```powershell
Select-String -Path src\**\*.tsx -Pattern ">[^<>{}]*[A-Za-z][^<>{}]*<"
Select-String -Path src\**\*.tsx -Pattern "placeholder=|aria-label=|title=|alt="
Select-String -Path src\**\*.tsx -Pattern "toast\(\{|EmptyState|DialogTitle"
Select-String -Path src\lib\*.ts -Pattern "const TEXT_|new Error\(|message:"
```

The inventory schema and copy rules are in `contracts/ui-copy.md` §4–§5.

## 2. Apply the approved copy

- One file at a time, only the approved rows; no other changes in that file.
- Role labels: `src/lib/labels.ts` per `contracts/role-labels.md`.
- Sidebar: `src/components/layout/AppShell.tsx` per `contracts/navigation.md`.

## 3. Static checks

```powershell
npx tsc --noEmit
npx eslint src/ --max-warnings 0
npm run build
```

All three must exit 0. ESLint is strict here: `--max-warnings 0` means an unused import
or an `any` warning fails the run.

## 4. Copy verification

```powershell
# Forbidden informal forms
Select-String -Path src\**\*.tsx -Pattern "\b(je|jij|jouw|jullie|jezelf)\b" -CaseSensitive:$false

# Raw role values in rendered output
Select-String -Path src\**\*.tsx -Pattern "\{profile\?\.role|\{m\.role|\{inv\.role"
Select-String -Path src\**\*.tsx -Pattern "'Admin'|'Lid'"

# Leftover English in visible copy (review each hit against the allowlist)
Select-String -Path src\**\*.tsx -Pattern ">([^<>{}]*(Roadmap|runs|features?|request|Command Center|Error|Admin|assistants?)[^<>{}]*)<"
```

Expected: no informal forms, no raw role render, no English hits that are not on the
allowlist or inside `<code>`.

## 5. Playwright

```powershell
# The feature's own test
npx playwright test tests/e2e/sidebar-navigation.spec.ts --project=chromium

# Regression suite (mock analysis server and dev server start automatically)
npx playwright test --project=chromium
```

What the new test proves (one test, adviseur fixture):

- the user block shows `Adviseur`, never `member`;
- `Roadmap` is absent from the main `nav`;
- `Ideeën en wensen` is visible in the `aside` but outside `nav`;
- clicking it opens `/roadmap` and the heading `Ideeën en wensen`.

The existing admin spec gains one assertion for the `Beheerder` label.

## 6. Manual walkthrough

1. Log in as beheerder: menu starts with **Overzicht**, no **Roadmap**; bottom block
   shows **Ideeën en wensen** and **Beheerder**.
2. Open **Ideeën en wensen**: page heading matches, the dialog reads **Idee of wens
   indienen**, submitting shows a Dutch toast.
3. Open **Team**: member and invitation badges read **Beheerder** / **Adviseur**; the
   invite select offers the same two names.
4. Open **Instellingen**: tenant role select reads **Beheerder** / **Adviseur**; no
   "tenant", "admin-gebruiker" or "assistants" in the surrounding Dutch copy.
5. Scan Geschiedenis, Assistenten, Kennisbronnen, chat and an analysis run for "runs",
   "features", "je" and English error text.
6. Repeat 1–2 as adviseur (fewer menu items, same label and position), and at 360px
   width with the mobile drawer open.
7. Log out and trigger a failed login: the message is Dutch (no "Invalid login
   credentials").

## 7. Wrap-up

- Update `FEATURES.md` with this feature.
- Run `bash scripts/fitness-check.sh` and write `FITNESS.md` per AGENTS.md.
- Commit with a conventional message, e.g.
  `feat(ui): unify Dutch copy, role labels and sidebar navigation`.

## Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| Playwright reports skipped tests | `E2E_*` credentials missing — expected locally; run with credentials for a real pass |
| `getByText('Adviseur')` matches twice | Scope the locator to the sidebar (`aside`) — the analysis form has an "Adviseur" field label |
| ESLint fails on an unused import after removing the roadmap icon usage | Remove the now-unused `Map` import only if the icon is truly gone; otherwise it is still used by the user-block link |
| Build fails on `tsc -b` after deleting a constant | Re-check that the inventory did not remove a still-referenced string |
