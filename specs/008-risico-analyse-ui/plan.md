# Implementation Plan: Risico-analyse assistent UI

**Branch**: `008-risico-analyse-ui` | **Date**: 2026-10-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/008-risico-analyse-ui/spec.md`

## Summary

Vaste chat-stijl flow (geen vrije chat) voor het nieuwe assistent-type
`risico_analyse` onder het bestaande Assistenten-tabblad: invoerformulier →
asynchrone run met statuskaart (polling, 1-3 min) → resultatenweergave
(gaps-checklist, interne analyse als gesanitiseerde markdown, klikbare
bronverwijzingen met zijpaneel, .docx-download met CONCEPT-label,
copy-to-clipboard), plus foutafhandeling met retry-prefill. De UI bouwt
eerst tegen een typed client met een lokale mock server; het echte
Supabase-backend (tabel + Edge Functions) is via contracts/ gespecificeerd
voor de backend-feature die volgt.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict), React 18, Vite 6

**Primary Dependencies**: bestaand uit `package.json` —
`@supabase/supabase-js` v2, `@tanstack/react-query` v5, `react-hook-form`
v7 + `@hookform/resolvers` + `zod` v3, `zustand` v5, `dompurify`,
`react-router-dom` v6, `lucide-react`, shadcn-stijl components in
`src/components/ui/`. Nieuw (enige toevoeging): `marked` (markdown →
HTML, daarna DOMPurify-sanitizing; geen raw HTML-pass-through).

**Storage**: Supabase (backend, buiten scope van deze UI-feature);
runs-polling in v1 tegen de mock server. Geen klantinhoud in
browseropslag; sessie-state in React Query + component state.

**Testing**: Playwright (via Playwright MCP, `tests/e2e/`) — happy path
formulier, groepsvalidatie, statusovergangen, bronpaneel, error+retry.

**Target Platform**: Desktop-first web (Netlify), responsief aanvaardbaar.

**Project Type**: web-app (SPA in bestaand Darwin frontend).

**Performance Goals**: submit < 1 minuut (SC-001); polling elke 3 s met
backoff; resultaatweergave renderen < 2 s op sample payload.

**Constraints**: WCAG 2.1 AA; geen klantinhoud in URL/console/logs
(SC-004); geen aanbevelingen, alles CONCEPT; runs max. 7 dagen
server-side bewaard (backend-contract); geüploade bestanden direct na
run verwijderd.

**Scale/Scope**: één assistent-type, ~20 runs per adviseur per dag;
recente-runs-lijst limiet 10.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principe | Gate | Status |
|---|-----------|------|--------|
| I | Dutch UI, English code | Alle UI-copy Nederlands formeel ("u/vorm"); code, identifiers en commit-berichten Engels | PASS |
| II | Concept, never advice | Result view toont "CONCEPT, door adviseur te accorderen"; copy vrij van aanbevelend taalgebruik; interne signalen gemarkeerd "intern, speculatief" | PASS |
| III | Client data sensitivity | Geen klantinhoud in URL (alleen run-UUID's), console, logs of PostHog; klantreferentie alleen als label in run-kaart; bestanden na run verwijderd (backend-contract); geen localStorage | PASS |
| IV | WCAG 2.1 AA | Formulierfouten inline + aria-live; toetsenbordbediening; focus-states; contrast via bestaande design tokens | PASS |
| V | Typed external clients | `src/lib/analysis-client.ts` met zod-schema's + expliciete foutstatussen; geen silent failures — alle calls gooien/getypeerde errors of tonen error-state | PASS |
| VI | Minimal scope | Geen follow-up chat, geen edit, geen extern zaaksysteem; mock-first; geen extra dependencies buiten `marked` | PASS |

Geen violations — geen Complexity Tracking nodig.

## Project Structure

### Documentation (this feature)

```text
specs/008-risico-analyse-ui/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── n8n-submit.md
│   ├── run-callback.md
│   ├── run-status.md
│   └── analysis-schema.md
└── tasks.md             # /speckit.tasks output (nog niet aangemaakt)
```

### Source Code (repository root)

```text
src/
├── components/
│   └── analysis/                  # nieuwe feature-componenten
│       ├── AnalysisForm.tsx      # invoerformulier (react-hook-form + zod)
│       ├── RunCard.tsx           # statuskaart + elapsed time
│       ├── ResultView.tsx        # gaps-checklist + analyse + acties
│       ├── GapsPanel.tsx         # "Ontbrekende informatie voor het gesprek"
│       ├── SourcePanel.tsx       # zijpaneel bronverwijzing (document/locatie/passage)
│       └── AnalysisMarkdown.tsx  # marked → DOMPurify (geen raw HTML)
├── lib/
│   ├── analysis-client.ts        # typed client: submit/poll/fixtures; expliciete error-states
│   └── analysis-schemas.ts       # zod: AnalysisResult, BronRef ^[KRA][0-9]+$, RunStatus
├── hooks/
│   └── useAnalysisRun.ts         # polling (3s, backoff) + statusovergangen
├── pages/
│   └── AssistantsPage.tsx        # uitbreiding: type 'risico_analyse' → AnalysisFlow i.p.v. ChatWindow
└── types/
    └── database.types.ts         # ai_assistants.type union uitbreiden 'risico_analyse' (frontend-type)

scripts/
└── mock-analysis-server.mjs      # Node-mock: endpoints n8n-submit/callback/status + fixtures
tests/
└── e2e/
    └── analysis-ui.spec.ts       # Playwright: formulier, status, bronpaneel, error+retry
```

**Structure Decision**: enkele bestaande SPA-structuur; feature-componenten
geïsoleerd in `src/components/analysis/`; client + schema's in `src/lib/`
naast bestaande `webhook.ts`-patroon. Mock server als los Node-script
(`scripts/`) zodat productie-code niet vervuild wordt.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

Geen violations.