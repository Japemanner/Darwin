# Phase 0 Research: Eenduidige Nederlandse UI-taal en navigatie

All decisions below are based on the current source tree (verified 2026-10-30) and the
answers Jaap gave before the spec was written: "Overzicht" for Command Center,
"gesprekken"/"uitvoeringen" per context for runs, and a fixed allowlist for technical
terms (Darwin, n8n, AI, webhook, URL, token, CORS, header, PDF, DOCX).

No `NEEDS CLARIFICATION` remains. Where the approved technical route and the spec touch
the same file, the resolution is recorded explicitly.

---

## D1 — One role label map in `src/lib/labels.ts`

**Decision**: Create `src/lib/labels.ts` exporting `ROLE_LABELS`
(`admin: 'Beheerder'`, `member: 'Adviseur'`) and `roleLabel(role)`, which returns
`'Beheerder'`, `'Adviseur'` or `'Geen rol'` for a missing/unknown value. Consumers:
`AppShell` (desktop and mobile user block), `TeamPage` (member badges, invitation
badges, invite options), `SettingsPage` (tenant role options, success copy, tenant
description).

**Rationale**: The raw values are rendered today in two separate sidebar blocks
(`AppShell.tsx` lines 109 and 148 render `profile?.role` directly), and "Admin"/"Lid"
literals are duplicated in `TeamPage.tsx` (options, two badge branches) and
`SettingsPage.tsx` (`TENANT_ROLE_OPTIONS`). One map removes the drift the spec is
complaining about and keeps the stored role values (`admin`/`member`, mirrored in
`src/types/database.types.ts`) untouched.

**Deviation from the route, resolved**: The route names AppShell and TeamPage as the
consumers. The spec (FR-005) also requires the tenant role select on Instellingen to
show "Beheerder"/"Adviseur"; leaving that page on "Admin"/"Lid" would fail SC-003. The
consumer list is therefore extended to `SettingsPage` — same map, no second source of
truth.

**Alternatives rejected**: per-file constants (drift returns); a translation framework
(new dependency, forbidden); a `Role` union type refactor (touches types and call sites,
behaviour-adjacent, out of scope).

**Ordering note**: each page keeps its current option order (`TeamPage` member first,
`SettingsPage` admin first) by deriving its option array from `ROLE_LABELS`. A shared
ordered `ROLE_OPTIONS` export would silently reorder one of the two selects — a
presentation change the spec does not ask for.

---

## D2 — "runs" per context

**Decision**: `gesprekken` in `HistoryPage` (it lists conversations), `uitvoeringen` in
the risk-analysis surface: `RecentRunsPanel` ("Recente uitvoeringen", "Nog geen
uitvoeringen gestart."), `ResultView` ("start een nieuwe uitvoering",
"uitvoeringsgegevens"), `analysis-client.ts` ("De uitvoering is niet gevonden.", "De
lijst met recente uitvoeringen kon niet worden uitgelezen."). Component/file/identifier
names stay English (`RecentRunsPanel`, `useRecentRuns`, `run` variables) per
Constitution I.

**Rationale**: A single Dutch word would mislabel one of the two screens — History
genuinely shows conversations, while the analysis pages show executions of a run.
"Uitvoering" is the neutral Dutch term and does not collide with "analyse" (the
result/analysis content).

**Alternatives rejected**: "analyses" everywhere (collides with the analysis content and
its statuses); "uitvoeringen" everywhere (wrong in History).

---

## D3 — "Command Center" becomes "Overzicht"

**Decision**: Nav label and page heading become `Overzicht`; the greeting stays:
`Overzicht — Welkom terug, {voornaam}`. The route `/command-center`, the file name
`CommandCenterPage.tsx`, and the redirect target in `App.tsx` stay unchanged.

**Rationale**: Confirmed with Jaap. Fully Dutch, matches the page's content (counts and
a welcome), and avoids an English loanword ("Dashboard") that the acceptance criterion
would otherwise have to allowlist.

**Alternatives rejected**: Dashboard (English), Startpagina (implies a start screen the
page is not).

---

## D4 — Menu entry "Ideeën en wensen" in the user block

**Decision**: Remove the roadmap entry from `navItems`; add a `<Link to="/roadmap">` with
the existing `Map` icon and the visible label `Ideeën en wensen` inside the bottom user
block of both the mobile drawer and the desktop `aside`, above the avatar row and below
the existing `border-t`. Visibility, route, page content, and the main-nav active-state
logic stay as they are; no active state is added to the new link.

**Rationale**: The sidebar duplicates its structure for mobile and desktop today; adding
the same five lines in both places matches the existing pattern and avoids refactoring
the shell (Constitution VI, "no refactors"). The icon is `aria-hidden` so the accessible
name is exactly the Dutch label. `text-sm` and the existing row padding keep the label
inside the 256px column.

**Alternatives rejected**: extracting a shared sidebar component (structural refactor
outside the spec); keeping the link in `navItems` and styling it differently (still in
the main menu); hiding it behind the avatar menu (new interaction behaviour; the spec
asks for a visible entry in the user block).

---

## D5 — English error text from external services

**Decision**: On the authentication paths (`LoginPage`, `ForgotPasswordPage`,
`ResetPasswordPage`) the user sees fixed Dutch copy instead of `error.message` from
Supabase Auth (e.g. "Invalid login credentials"). The technical detail stays in the
existing `console.error` calls where they already exist; no client content is added to
logs. Error states remain visible (`role="alert"` / destructive toast). Our own client
messages (already Dutch in `analysis-client.ts`, `rag-client.ts`, `storage.ts`,
`flow-config-client.ts`) and Dutch messages returned by our Edge Functions keep flowing
through unchanged.

**Rationale**: These are the only places where the app today renders an English string
verbatim to the user (the acceptance criterion names "Error"). Rewriting every
`err.message` site would remove diagnostic nuance, touch unrelated flows, and risk
behaviour changes. Pass-through of our own Dutch service messages is existing behaviour
and is preserved.

**Alternatives rejected**: a generic `userFacingError(err)` helper with a language
heuristic (fragile, new abstraction); translating every external message centrally
(needs an error catalogue — out of scope).

---

## D6 — Technical allowlist and n8n interface labels

**Decision**: Allowed in visible copy: `Darwin`, `n8n`, `AI`, `webhook`, `URL`, `token`,
`CORS`, `header`, `PDF`, `DOCX`, and literal n8n labels when the Instellingen guide
tells the user where to click (`Settings → Authentication → Header auth`,
`Production URL`, `Test URL`, `Header Name`, `Header Value`, `Active`). Everything else
in our own prose is translated: `assistants` → `assistenten`, `tenant` → `organisatie`,
`signed download URL` → `ondertekende download-URL`, `payload` → `bericht`,
`server-side` → `aan de serverkant`, `vector database` → `kennisindex`,
`workflow` → `werkstroom`, `upload` as a noun → `bestand`/`aanlevering` where it reads as
English. Code identifiers inside `<code>` (`tenantId`, `knowledgeSourceName`,
`document_name`, `document_type`, `download_url`) stay as they are: they are API field
names, not prose.

**Rationale**: The guide is unusable if it renames n8n's own controls; the allowlist is
the one Jaap confirmed. Identifiers are code (Constitution I) and must match the actual
payload.

**Note**: `N8N Webhook URL` (Assistants form label) and `Webhook URL`, `Webhook Token`,
`Auth Header Naam` (Instellingen) contain only allowlisted words; they are kept to avoid
churn and because `flow-config.spec.ts` selects the `Webhook URL` label. The inventory
lists them as reviewed/no-change.

---

## D7 — Inventory completeness method and approval gate

**Decision**: The inventory is the first implementation step and a hard gate. It is a
Markdown table `| # | bestand | scherm/onderdeel | oud | nieuw |`, grouped per file,
plus a "reviewed, unchanged" list. Coverage is built from four searches (JSX text,
attributes, feedback components, error/status strings in `src/lib`), then a full read of
every file that produced a hit. Approval happens in conversation before step 2; rows
changed at the gate are updated in the inventory first.

**Rationale**: FR-012 and the route both require an auditable old → new list; the
steekproef in SC-005 only works if unchanged strings are also listed. Grep alone misses
multi-line JSX and template literals, so the file read is mandatory.

**Alternatives rejected**: generating the list from a script (no reliable JSX text
extractor without a new dependency); inventory after the edits (no approval gate).

---

## D8 — Playwright coverage for the sidebar

**Decision**: One new test in `tests/e2e/sidebar-navigation.spec.ts` using the existing
`memberPage` fixture (real login, skips with a reason without
`E2E_MEMBER_EMAIL`/`E2E_MEMBER_PASSWORD`). It asserts the adviseur label, that Roadmap
is gone from `nav`, that "Ideeën en wensen" sits outside `nav` but inside the `aside`,
and that it opens `/roadmap` with the matching heading. One assertion is added to the
existing admin test in `admin-only-management.spec.ts` for the "Beheerder" label.

**Rationale**: The repo's e2e tests authenticate for real and mock only data routes;
there is no session-faking helper and adding one would be new test infrastructure
(scope). `memberPage` is the stricter case (fewer nav items, so the menu assertion is
unambiguous). The admin label is covered with a single added assertion instead of a
second test, keeping the "one new test" deliverable.

**Alternatives rejected**: a credential-free test with a faked Supabase session
(fragile, requires knowledge of the project ref in localStorage); two new tests (more
than asked, duplicates the same flow).

---

## D9 — Copy scope of the auth and analysis error strings

**Decision**: Only user-visible strings change. Where a status or error string is
asserted by an existing spec (`/in wachtrij|bezig/`, `/klaar/`, `/mislukt/`,
`/beschikbaar tot/`, `Nog geen documenten`, `1 fout`, `Verwerken...`), the wording is
kept. The status vocabulary already in use (wachtrij, bezig, klaar, mislukt, verwerken)
is Dutch and consistent, so it is not renamed.

**Exception found while building the inventory**: the loanwords "Upload" and "Download"
are not on the allowlist, so `Uploaden...`, `Upload mislukt`, `Document geüpload` and
the two dossier-download labels are translated. Two `document-webhook.spec.ts` selectors
(`Document geüpload`, `Upload mislukt`) are updated with them — the only existing
selectors that change.

**Rationale**: Keeps the diff text-only and avoids unnecessary test churn while still
meeting the acceptance criteria.

**Alternatives rejected**: normalising statuses to new words (would break specs and add
no language value).
