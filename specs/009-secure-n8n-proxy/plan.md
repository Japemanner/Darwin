# Implementation Plan: Beveiligde n8n-koppeling via de server

**Branch**: `009-secure-n8n-proxy` | **Date**: 2026-10-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/009-secure-n8n-proxy/spec.md`; technische route uit `docs/verbeterplan-opencode.md` groep A (A2).

## Summary

Alle n8n-communicatie verhuist uit de browser naar drie nieuwe Supabase Edge
Functions in de bestaande huisstijl (auth-patroon `invite-user`):
`rag-chat` (chatvraag server-side laten beantwoorden: sessiecheck,
organisatie- en kennisbron-bepaling, n8n-payload met
`knowledge_sources: string[]` plus legacy `knowledgeSourceName`), 
`document-webhook` (upload/verwijder-melding met server-gemaakte signed URL,
verwijderen meldt vóór de lokale delete) en `flow-config` (get/save/test voor
beheerders; token write-only, platte tekst). De frontend krijgt typed clients
(`src/lib/rag-client.ts`, `src/lib/flow-config-client.ts`, typed invoke in
`storage.ts`), `src/lib/webhook.ts` verdwijnt inclusief
`VITE_ENCRYPTION_KEY`. Migratie 014 wist de gelekte tokens en trekt de
leesrechten op `flow_configs` in (REVOKE/GRANT per kolom). De
risico-analyse-client stuurt op alle drie de calls het sessie-JWT mee
(backwards-compatibel met de mock server). Fitness-check F-18 blokkeert
`VITE_ENCRYPTION_KEY`/`crypto.subtle.decrypt` in `src/`. Playwright-testen
mocken de edge functions met `page.route`; de rolloutvolgorde
(functions → frontend → migratie → token-invoer) staat in quickstart.md.

Drie bewuste beslissingen binnen de route van de opdrachtgever, gemarkeerd
voor review (goedgekeurd):

1. **Score-passthrough**: `rag-chat` stuurt bronnen ongewijzigd door
   (inclusief `knowledge_item_id`/`score`) zodat de huidige UI (percentage-
   badge) blijft werken; het verwijderen van de score-weergave is feature F.
2. **Per-assistant webhook-URL blijft**: de fallback op
   `assistant.n8n_webhook_url` (zonder token, alleen voor de types waar de
   huidige code hem ook gebruikt) wordt overgenomen in de Edge Function —
   huidig gedrag blijft behouden; weglaten zou voor die assistenten "ik merk
   geen verschil" breken. Rest-risico, geaccepteerd als spec-aanname: de
   token-loze fallback-URL blijft rechtstreeks bij n8n aanroepbaar;
   authenticatie per assistent valt buiten deze feature.
3. **Delete-volgorde wisselt**: n8n wordt gemeld vóór de lokale verwijdering
   (de Edge Function moet de rij kunnen lezen; spec US2 scenario 3: bij
   mislukking blijft het document staan).

Aanvullende hardening uit de security-review (opgelost in de artefacten):

4. **SSRF-guards**: alle uitgaande webhook-URL's worden server-side
   gevalideerd (https, geen letterlijk IP/localhost/link-local); de
   verbindingstest stuurt het opgeslagen token nooit naar een afwijkende URL
   (weigering met NL-melding).
5. **Policy-fix (review-severity HIGH)**: migratie 014 hercreëert de
   `flow_configs`-UPDATE-policy mét `WITH CHECK` — zonder die clausule kan
   een beheerder een config-rij naar een andere organisatie verhuizen en zo
   diens chatverkeer laten aflopen op een eigen webhook.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict), React 18, Vite 6; Deno (Edge Functions)

**Primary Dependencies**: bestaand uit `package.json` — `@supabase/supabase-js` v2 (`functions.invoke`), `zod` v3, `@tanstack/react-query` v5, Playwright (dev). **Geen nieuwe npm-dependencies** (verbeterplan-randvoorwaarde). Edge Functions gebruiken de reeds aanwezige Deno-conventies.

**Storage**: Supabase PostgreSQL; `flow_configs` krijgt alleen privilege-wijzigingen (REVOKE/GRANT + token-wipe, migratie 014); private bucket `knowledge-documents` met server-side signed URL's (900 s).

**Testing**: Playwright (`tests/e2e/`) met `page.route('**/functions/v1/…')` voor succes én elke foutcode; echte login via `E2E_EMAIL`/`E2E_PASSWORD` (bestaande fixture); mock-analyse-server blijft draaien (negeert de nieuwe JWT-header, backward-compatibel).

**Target Platform**: Netlify (SPA) + Supabase (één productieproject — releasevolgorde is een harde constraint).

**Project Type**: web-app (bestaand Darwin frontend + Supabase backend).

**Performance Goals**: chatantwoord binnen 60 s (server-side n8n-fetch; de server garandeert altijd een respons); documentmelding 10 s; verbindingstest 10 s (portering van huidige time-outs, chat verruimd van 30 s naar 60 s conform de route).

**Constraints**: constitution III — Edge Function-logs bevatten alleen code/id's/duur, nooit berichtinhoud; constitution V — typed clients, alle fouten zichtbaar; geen `VITE_ENCRYPTION_KEY` meer in bundel of repo; geen migratie/deploy zonder expliciete bevestiging van de opdrachtgever (productie).

**Scale/Scope**: 3 Edge Functions, 1 migratie, 2 nieuwe clientbestanden, ~6 gewijzigde frontendbestanden, 1 fitness-check, e2e-suite.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principe | Gate | Status |
|---|-----------|------|--------|
| I | Dutch UI, English code | Alle nieuwe UI-tekst Nederlands in u-vorm (foutmeldingen, placeholders); code, identifiers, commits Engels | PASS |
| II | Concept, never advice | Geen gegenereerde output toegevoegd in deze feature; chat-UI wordt niet herontworpen; geen aanbevelende copy | PASS |
| III | Client data sensitivity | Edge Functions loggen alleen code, id's en duur (contracten); berichtinhoud verlaat de browser alleen richting de eigen backend en vandaar naar de geconfigureerde n8n-webhook; geen inhoud in URL's of logs | PASS |
| IV | WCAG 2.1 AA | Foutmeldingen via bestaande toast-componenten (aria-live) en inline resultbox in Instellingen; geen nieuwe componenten zonder focus/contrast | PASS |
| V | Typed external clients, no silent failures | `rag-client.ts`, `flow-config-client.ts` en de typed document-webhook-invoke met zod-validatie + foutcodes; de huidige stille `console.error`-paden van `callDocumentWebhook` vervallen (NL-melding); alle codes UNAUTHORIZED…UPSTREAM_UNREACHABLE afgedekt | PASS |
| VI | Minimal scope | Alleen de route uit verbeterplan A2; geen nieuwe dependencies; n8n-workflows, berichtopslag en chat-UI onaangetast. De drie gemarkeerde beslissingen (score-passthrough, URL-fallback, delete-volgorde) zijn gedragsbehoud, geen functie-uitbreiding | PASS |

Geen violations — geen Complexity Tracking nodig.

## Project Structure

### Documentation (this feature)

```text
specs/009-secure-n8n-proxy/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output (rolloutvolgorde)
├── contracts/           # Phase 1 output
│   ├── rag-chat.md
│   ├── document-webhook.md
│   └── flow-config.md
├── checklists/
│   └── requirements.md  # /speckit.specify output
└── tasks.md             # /speckit.tasks output (nog niet aangemaakt)
```

### Source Code (repository root)

```text
supabase/
├── functions/
│   ├── rag-chat/index.ts            # NIEUW: sessiecheck → n8n → genormaliseerd antwoord
│   ├── document-webhook/index.ts   # NIEUW: index/modify/delete + server-side signed URL
│   └── flow-config/index.ts         # NIEUW: get/save/test voor beheerders
└── migrations/
    └── 014_flow_configs_token_lockdown.sql  # NIEUW: token-wipe + REVOKE/GRANT

src/
├── lib/
│   ├── rag-client.ts                # NIEUW: typed client voor rag-chat (zod, foutcodes, NL-teksten)
│   ├── flow-config-client.ts        # NIEUW: typed client voor flow-config (get/save/test)
│   ├── webhook.ts                   # VERWIJDERD (encrypt/decrypt + directe n8n-calls vervallen)
│   ├── storage.ts                   # document-webhook-invoke; delete meldt vóór lokale delete
│   └── analysis-client.ts           # Authorization: Bearer op alle drie de calls
├── pages/
│   ├── AssistantsPage.tsx          # ChatWindow gebruikt rag-client; toast-titels per foutcode
│   ├── SettingsPage.tsx             # FlowConfigCard via flow-config; token write-only; alleen beheerders
│   └── KnowledgePage.tsx            # delete-toast toont de NL-melding + foutcode
├── hooks/
│   └── queries.ts                   # useFlowConfig + useSaveFlowConfig VERWIJDERD (enige consumer was SettingsPage)
├── components/
│   └── ui/toast.tsx                 # role="status"/aria-live (toegankelijke foutmeldingen, FR-009)
├── types/
│   └── database.types.ts            # ongewijzigd (webhook_token-kolom blijft bestaan)
└── vite-env.d.ts                    # VITE_ENCRYPTION_KEY verwijderd

scripts/
└── fitness-check.sh                 # NIEUWE CHECK F-18: geen VITE_ENCRYPTION_KEY / crypto.subtle. in src/

tests/
└── e2e/
    ├── rag-chat.spec.ts             # NIEUW: succes + elke foutcode + geen n8n-verkeer
    ├── document-webhook.spec.ts     # NIEUW: upload/delete-melding, NL-fout, document blijft staan
    ├── flow-config.spec.ts          # NIEUW: has_token, write-only, test-resultaat
    └── analysis-jwt.spec.ts         # NIEUW: Authorization-header aanwezig op de drie calls

.env.example                         # VITE_ENCRYPTION_KEY verwijderd
```

**Structure Decision**: Edge Functions volgen de bestaande platte
`supabase/functions/<naam>/index.ts`-conventie (geen gedeelde modules, auth via
`supabase.auth.getUser`, secrets via `Deno.env.get`, CORS nu via
`ALLOWED_ORIGINS`). Frontend-clients in `src/lib/` naast het
`analysis-client.ts`-patroon: één typed client per Edge Function, geen
generieke "edge-proxy"-abstractie (constitution VI).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

Geen violations.