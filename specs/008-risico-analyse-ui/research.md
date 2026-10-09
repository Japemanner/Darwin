# Research: Risico-analyse assistent UI

**Feature**: 008-risico-analyse-ui | **Datum**: 2026-10-09

## R1. Frontendstack en hergebruik

- Decision: het bestaande Darwin frontend bepaalt de stack — React 18 +
  TypeScript strict + Vite 6 + Tailwind v3 + shadcn-stijl componenten in
  `src/components/ui/`. Geen Next.js (bestaand project is Vite SPA).
- Rationale: Surgical changes (constitution VI + Karpathy): het opnemen
  van een nieuw framework is onnodig en risicoverhogend.
- Alternatives considered: Next.js-migratie (verworpen — bestaand project
  en deploy via Netlify al ingericht), aparte micro-frontend (verworpen —
  onevenredig complex voor één scherm).
- Hergebruik: auth via `useAuth`/`authStore` (PKCE, `src/lib/supabase.ts`),
  layout via `AppShell`, kennisbron-query's via `@/hooks/queries`
  (`useAssistantKBLinks`), UI-componenten uit `src/components/ui/`,
  foutmeldingen via `useToast`, design tokens uit Tailwind-config.

## R2. Run-status transport: polling vs. SSE

- Decision: polling elke 3 seconden met exponentiële backoff bij
  verbindingsfouten (max ~30 s interval), stoppen zodra status `klaar` of
  `mislukt` is.
- Rationale: run duurt 1-3 minuten; polling via TanStack Query
  (`refetchInterval`) is het eenvoudigste betrouwbare patroon en de spec
  markeert push expliciet als geen v1-eis. SSE vereist extra infrastructuur
  op het backend en winst is beperkt bij 1 run per keer.
- Alternatives considered: SSE (verworpen voor v1 — backend-complexiteit),
  Supabase Realtime subscriptions (verworpen — koppelt UI aan het echte
  backend terwijl v1 mock-first is).

## R3. Backend-architectuur achter de contracts (voor latere backend-feature)

- Decision: het echte Darwin backend bestaat uit een Supabase-tabel
  `analysis_runs` (RLS: adviseur ziet eigen runs) plus twee Edge
  Functions: `analysis-run-submit` (multipart van UI → n8n-webhook met
  gedecrypteerd token uit `flow_configs`, service-role) en
  `analysis-run-callback` (n8n → Supabase: status/resultaat/dossier
  wegschrijven, storage-signed-URL voor .docx, purge na 7 dagen). De UI
  pollt in de echte versie rechtstreeks de `analysis_runs`-tabel via
  `supabase-js` onder RLS.
- Rationale: webhook-tokens zijn AES-GCM-versleuteld opgeslagen en horen
  niet geoncrypteerd naar de client; multipart-forwarding vanuit een Edge
  Function vermijdt n8n-CORS-problemen; RLS garandeert dat een adviseur
  alleen eigen runs ziet. Voor déze UI-feature wordt alles gemockt;
  contracts/ documenteert deze afspraken zodat backend en n8n-workflow
  los kunnen bouwen.
- Alternatives considered: browser → n8n direct (verworpen — token-decrypt
  in client en multipart-CORS), tabel-polling door Edge Function
  (verworpen — onnodige hops).

## R4. Markdown-rendering zonder raw HTML

- Decision: `marked` (markdown → HTML) direct gevolgd door de bestaande
  DOMPurify-sanitizer in `src/lib/sanitize.ts`, uitgebreid met
  tabel-heading-tags en `h4`. Raw HTML in markdown wordt door
  DOMPurify-configuratie weggefilterd (ALLOWED_TAGS-whitelist).
- Rationale: intern_markdown uit de backend is onvertrouwde content;
  sanitizing na rendering is verplicht (constitution III/V + gebruikerseis
  "no raw HTML"). `marked` is de lichtststandaard optie; DOMPurify is al
  in het project aanwezig (`@types/dompurify` + `dompurify`).
- Alternatives considered: `react-markdown` (verworpen — zwaardere dep,
  meer React-koppeling), handgeschreven mini-parser (verworpen —
  onderhoudslast en veiligheidsrisico).

## R5. Bronverwijzingen en zijpaneel

- Decision: bron-id's volgen `^[KRA][0-9]+$` (K = kennisbron-document,
  R = regelgeving/regel, A = artikel/bijlage). Zod-schema valideert id's;
  het resultaat bevat een `bronnen`-map waarin elk id naar document,
  locatie en letterlijke passage verwijst. De analyse-markdown bevat
  klikbare verwijzingen (bijv. `[K1]`) die het zijpaneel openen met de
  passage. Ontbrekende id in de map → expliciete melding (spec FR-012).
- Rationale: resolitie volledig client-side mogelijk (map zit in het
  resultaat-payload); geen extra backend-call nodig; voldoet aan SC-003.
- Alternatives considered: per-referentie backend-lookup (verworpen —
  extra round-trips en backend-koppeling in mock-fase).

## R6. Mock server en fixtures

- Decision: los Node-script `scripts/mock-analysis-server.mjs` (geen
  nieuwe dependency) met endpoints conform contracts: submit (202 +
  run_id), status (overgangen in wachtrij → bezig → klaar/mislukt) en
  resultaat. Fixtures: rich result (alle secties + volledige bronnen),
  thin result (veel lacunes, karige analyse), error result (code +
  message), slow run (bezig ≥ 2 min). De UI schakelt tussen mock en
  echt backend via omgevingsvariabele `VITE_ANALYSIS_API_URL`
  (ontbreekt: lokale mock). Playwright-tests draaien tegen de mock met
  gefixeerde tijdlijnen (deterministisch).
- Rationale: mock-first volgens gebruikersinstructie; geen test-framework
  toegevoegd buiten Playwright (al standaard in AGENTS.md); deterministische
  fixtures maken statusovergangen testbaar.
- Alternatives considered: MSW (verworpen — extra dependency),
  fixtures inline in de app (verworpen — vervuilt productiecode).

## R7. Privacy in logging, URLs en analytics

- Decision: routes bevatten uitsluitend run-UUID's
  (`/assistants/:assistantId/runs/:runId`); geen klantreferentie, geen
  bestandsnamen, geen URL-invoer in routes of query-strings. De client
  logt nooit payload-inhoud (ook niet in errors — alleen codes/status).
  PostHog blijft beperkt tot bestaande gebruikersidentificatie; geen
  events met klantinhoud. Formulier-retry-state blijft in memory
  (React state/zustand store, niet localStorage/sessionStorage) —
  vervalt dus na de sessie, conform Principe III.
- Rationale: constitution III + SC-004; bestaande authStore-log-regels
  tonen geen klantinhoud.
- Alternatives considered: sessionStorage voor retry-prefill over
  sessies heen (verworpen — Principe III zegt "beyond the session"
  niet toegestaan).

## R8. Zod-schema's voor analyse-JSON

- Decision: `src/lib/analysis-schemas.ts` valideert met zod:
  `risicos[]`, `dekking`, `restgat`, `draagkracht`, `opties[]`
  (met voor/tegen), `lacunes[]` (gaps-checklist), `intern_signalen[]`
  (gemarkeerd "intern, speculatief") en `bronnen[]` met id-patroon
  `^[KRA][0-9]+$` plus document/locatie/passage. Foutschema
  `{status:"error", code, message}`. Ongeldig resultaat → expliciete
  foutstatus in de UI (geen silent failure, Principe V).
- Rationale: gebruikersinstructie schrijft zod + dit exacte veldpatroon
  voor; gescheiden schema-module maakt de client testbaar zonder UI.
- Alternatives considered: TypeScript-interfaces zonder runtime-validatie
  (verworpen — constitution V vereist getypeerde client mét
  expliciete foutafhandeling van externe data).