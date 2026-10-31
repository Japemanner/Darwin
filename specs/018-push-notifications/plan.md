# Implementation Plan: Pushmeldingen voor afgeronde risico-analyses

**Branch**: `018-push-notifications` | **Date**: 2026-10-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/018-push-notifications/spec.md`

## Summary

Voeg Web Push (VAPID, RFC 8291/8292) toe voor afgeronde en mislukte
risico-analyses, zonder Firebase SDK en zonder web app manifest. De adviseur
zet meldingen per apparaat aan in het gebruikersblok onderaan de zijbalk; de
service worker toont alleen de twee voorgeschreven Nederlandse teksten en opent
bij klik `/analyse/<run-id>`. Abonnementen staan per gebruiker per apparaat in
`push_subscriptions` met RLS. Eén serverside Edge Function `push-send` verstuurt
naar alle apparaten van één gebruiker; de risico-analysecallback is de enige
aanroeper. De VAPID private key staat uitsluitend als Supabase secret.

De technische kernbeslissing: **`npm:web-push` is niet bruikbaar in de Supabase
Edge Runtime** — de bibliotheek leunt op Node's `crypto.createECDH`, dat Deno
niet implementeert (research R1). Daarom gebruikt de send-functie
**`jsr:@negrel/webpush`**, een Deno-native Web Push-implementatie op Web Crypto.
Echte pushbezorging is niet in Playwright te testen; de UI-tests dekken
aanzetten/uitzetten/weigeren met een gestubde `PushManager`, en de send-logica
krijgt aparte Node-unit tests met een geïnjecteerde fetch.

## Technical Context

**Language/Version**: TypeScript ~5.6 (frontend, React 18 + Vite 6); TypeScript
op Deno (Supabase Edge Runtime) voor `push-send`; Node 24 voor scripts en
unit-tests.

**Primary Dependencies**: `jsr:@negrel/webpush@0.5.0` (nieuw, server-side only),
`@supabase/supabase-js@2` (bestaand), `@tanstack/react-query@5` (bestaand),
`zustand@5` (bestaand), `@playwright/test@1.64` (bestaand). Geen nieuwe
npm-dependency in de frontend.

**Storage**: PostgreSQL-tabel `push_subscriptions` met RLS (nieuwe migratie
`019_push_subscriptions.sql`); geen storage-bucket, geen browseropslag.

**Testing**: Playwright (Chromium) voor aanzetten/uitzetten/weigeren/niet-
ondersteund; `node --test` voor de pure send-logica (`logic.ts`) met
geïnjecteerde `fetch` en pushfunctie; bestaande suite blijft groen.

**Target Platform**: actuele Chrome, Edge en Firefox op Windows en macOS, Safari
op macOS, Chrome op Android. Geen iOS/iPadOS, geen installatie als app.

**Project Type**: single-page web-app + Supabase Edge Functions in hetzelfde
repository.

**Performance Goals**: melding binnen 10 s na de statusovergang (netwerk- en
pushdienstlatentie inbegrepen); send-functie verwerkt alle abonnementen van één
gebruiker binnen de Edge Function-timeout (verwachting: < 2 s bij ≤ 5
apparaten). Aanzetten/uitzetten voelt direct (optimistische status, foutmelding
bij mislukken).

**Constraints**: push-payload bevat uitsluitend `kind` en `run_id`; geen
klantreferentie, klantgegevens of analyse-inhoud (constitution III). Service
worker heeft geen `fetch`-handler, geen cache en schrijft niets weg. VAPID
private key alleen als Supabase secret. Knop en status WCAG 2.1 AA. De
analysecallback mag nooit falen door een pushfout.

**Scale/Scope**: enkele tientallen adviseurs per tenant, 1–5 apparaten per
adviseur; één tabel, één Edge Function, één service worker, één UI-component,
één migratie.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principe | Gate | Status |
|---|---|---|
| I. Dutch UI, English code | Knop, status en uitleg in het Nederlands (u-vorm); code, comments, commits Engels | PASS |
| II. Concept, never advice | Meldingsteksten zijn neutraal en bevatten geen advies of aanbeveling; geen CONCEPT-label nodig omdat er geen gegenereerde inhoud wordt getoond | PASS |
| III. Client data sensitivity | Payload = `{kind, run_id}`; geen klantinhoud in logs, URL's of opslag; service worker schrijft niets; abonnementen server-side per gebruiker; input-URL's zijn relatieve, allowlisted paden (geen absolute URL's, dus geen phishing-vector) | PASS |
| IV. Accessibility WCAG 2.1 AA | Echte knop, zichtbare focus, status als tekst (niet kleur-only), `aria-live="polite"` voor statuswijzigingen, toetsenbordbedienbaar | PASS |
| V. Typed clients, no silent failures | `push-send` valideert invoer met een typed schema en geeft expliciete foutcodes; frontend toont fouten bij aan/uitzetten; mislukte verzending wordt gelogd (code + aantallen) en blokkeert de callback niet | PASS |
| VI. Minimal scope | Geen manifest, geen iOS, geen voorkeuren/stille uren, geen extra tabellen, geen retry-queue, geen SDK | PASS |

**Configuratie-uitzondering (geen violation)**: `VITE_VAPID_PUBLIC_KEY` is
toegevoegd aan de frontend-config. De VAPID **public** key is per definitie
openbaar, voor alle tenants gelijk en per omgeving instelbaar — precies de
drie voorwaarden uit `decisions/2026-10-30-config-environment-vs-ui.md` en de
`VITE_*`-regel in AGENTS.md. De private key blijft een Supabase secret. Geen
Complexity Tracking nodig.

**Hercontrole na Phase 1**: zie [research.md](./research.md) R1–R8 en
[data-model.md](./data-model.md); geen principle-violations gevonden.

## Project Structure

### Documentation (this feature)

```text
specs/018-push-notifications/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── push-send.md
│   ├── push-payload.md
│   └── analysis-callback-integration.md
├── checklists/requirements.md
└── tasks.md             # Phase 2 output (/speckit.tasks — niet nu)
```

### Source Code (repository root)

```text
public/
└── sw.js                                  # service worker: push + notificationclick, niets anders

src/
├── components/layout/
│   ├── AppShell.tsx                       # gebruikersblok (mobiel + desktop): control toevoegen
│   └── PushNotificationControl.tsx        # NEW: knop + status + Nederlandse uitleg
├── hooks/
│   └── usePushSubscription.ts             # NEW: statusmachine voor dit apparaat
├── lib/
│   └── push/
│       ├── client.ts                      # NEW: support/permalink/subscribe/unsubscribe/status
│       └── types.ts                       # NEW: PushKind, PushStatus, foutcodes
└── store/
    └── authStore.ts                       # signOut: eerst abonnement van dit apparaat verwijderen

supabase/
├── migrations/
│   └── 019_push_subscriptions.sql         # NEW: tabel + RLS + indexen
└── functions/
    └── push-send/
        ├── index.ts                       # NEW: Deno.serve, env, Supabase service-role
        ├── logic.ts                       # NEW: pure validatie/payload/verzendloop (Node-testbaar)
        └── logic.test.ts                  # NEW: node --test

scripts/
└── generate-vapid-keys.mjs                # NEW: eenmalig VAPID-sleutelpaar genereren

tests/e2e/
└── push-notifications.spec.ts             # NEW: aanzetten, uitzetten, geweigerd, niet ondersteund
```

**Structure Decision**: de bestaande single-projectstructuur blijft intact. De
frontend krijgt één nieuwe map `src/lib/push/` en één component in
`src/components/layout/`; de serverkant volgt de bestaande
`supabase/functions/<naam>/index.ts`-conventie. De service worker staat bewust
in `public/` (root scope, geen bundelstap, geen Workbox).

## Implementation Phases

### Phase A — Server foundations

1. **Verificatie callback (gate)**: controleer via Supabase MCP of
   `analysis-run-callback` bestaat (`supabase functions list` / MCP). De repo
   bevat géén `analysis_runs`-migratie en géén callback-functie: het echte
   analyse-backend staat buiten deze repository (spec 008, research R3). Leg de
   uitkomst vast in `quickstart.md` §0.
   - Bestaat de functie: integratie toevoegen volgens
     `contracts/analysis-callback-integration.md`.
   - Bestaat de functie niet: `push-send` + abonnementen + UI worden volledig
     opgeleverd en getest; de callback-hook blijft een expliciete, gedocumenteerde
     afhankelijkheid (geen verzonnen backend).
2. **Migratie** `019_push_subscriptions.sql`: tabel, unieke index, RLS-policies
   (select/insert/delete eigen rijen; geen update), `updated_at`-trigger
   alleen als het huispatroon dat vereist — hier niet nodig, dus alleen
   `created_at`. Toepassen via Supabase MCP, daarna RLS verifiëren.
3. **VAPID**: `scripts/generate-vapid-keys.mjs` (Node Web Crypto, ECDSA P-256)
   genereert `VAPID_KEYS` (JWK-paar) en de base64url public key. Secrets:
   `VAPID_KEYS`, `VAPID_SUBJECT`, `PUSH_SEND_TOKEN`. Frontend:
   `VITE_VAPID_PUBLIC_KEY` in `.env.example`, `.env.local` en Netlify.
4. **`push-send`**: `logic.ts` (pure) + `index.ts` (Deno). Zie
   `contracts/push-send.md`. Invoer: `{ user_id, kind, url }`. Payload:
   `{ kind, run_id }`. Verlopen/ongeldig (404/410) → rij verwijderen.
   Mislukking → log code + aantallen, nooit endpoint of klantdata; altijd een
   200-respons met `{sent, removed, failed}` zodat de callback niet faalt.

### Phase B — Frontend

5. **Service worker** `public/sw.js`: alleen `push` en `notificationclick`.
   Titel = exact "Uw risico-analyse is gereed" of "Uw risico-analyse is
   mislukt"; `tag` = run-id (voorkomt dubbele meldingen); klik opent/focust
   `/analyse/<run-id>`.
6. **Client** `src/lib/push/`: supportdetectie, permissiestatus,
   `applicationServerKey` decoderen (base64url via `atob`, géén `crypto.subtle`
   in `src/` — fitness F-18), abonneren/afmelden, rij in
   `push_subscriptions` schrijven/verwijderen, status afleiden uit
   `pushManager.getSubscription()` + eigen rij.
7. **UI** `PushNotificationControl`: in het gebruikersblok van beide zijbalken.
   Statussen: `aan`, `uit`, `geblokkeerd`, `niet ondersteund`, `bezig`, `fout`.
   Alleen bij `uit` een knop "Meldingen aanzetten"; bij `aan` "Meldingen
   uitzetten"; anders uitleg. `Notification.requestPermission()` synchroon in de
   click-handler (user gesture).
8. **Uitloggen**: `authStore.signOut` verwijdert eerst het abonnement van dit
   apparaat (DB-rij + `subscription.unsubscribe()`), dan `auth.signOut()`.
   Mislukt dat, dan gaat uitloggen gewoon door (stil, gelogd zonder klantdata).

### Phase C — Verification

9. **Playwright** `tests/e2e/push-notifications.spec.ts`: `test.use({ permissions:
   ['notifications'] })` + `addInitScript`-stub voor `PushManager` (echte push is
   niet testbaar), aanzetten → status "aan" en blijft "aan" na reload; uitzetten
   → status "uit" en rij weg; geweigerd → uitleg zonder knop; niet ondersteund →
   uitleg. Gebruik de `memberPage`-fixture (adviseur, geen admin) om te bewijzen
   dat het gebruikersblok niet admin-only is.
10. **Unit** `node --test supabase/functions/push-send/logic.test.ts`: geldige
    invoer, ongeldige URL/kind, payload bevat precies twee velden, 404/410 →
    verwijderen, overige fout → `failed` zonder throw, geen klantdata in logs.
11. **Handmatige smoke** (quickstart §5): echte browser, echte push, app
    gesloten, klik opent juiste analyse.
12. **Documentatie**: FEATURES.md, `.env.example`, `quickstart.md`;
    agent-context in AGENTS.md bijwerken naar dit plan.

## Risks & Mitigations

| Risico | Mitigatie |
|---|---|
| `npm:web-push` werkt niet in de Edge Runtime (bevestigd: `crypto.createECDH` ontbreekt in Deno) | Deno-native `jsr:@negrel/webpush` op Web Crypto; deploy-smoke test in Phase A4 |
| `@negrel/webpush` onbewezen op Supabase Edge Runtime | Minimale deploy + `push-send`-aanroep met één echte subscription; bij falen fallback naar `@block65/webcrypto-web-push` (Web Crypto, bewezen patroon) — alleen dan |
| `PushManager.subscribe()` faalt in headless Chromium (geen pushdienst) | Playwright stubt `PushManager`; echte bezorging alleen in de handmatige smoke-test |
| `analysis-run-callback` bestaat niet in deze repo/Supabase | Gate in Phase A1; UI + send-functie zijn los testbaar; callback-hook als contract + afhankelijkheid gedocumenteerd |
| Abonnement verwijderen bij uitloggen faalt (netwerk) | Uitloggen gaat door; verlopen abonnement wordt bij de volgende verzending opgeruimd (404/410) |
| Pushdienst-fout blokkeert de analysecallback | `push-send` gooit nooit; callback-hook heeft 5 s timeout en catch-and-log |

## Complexity Tracking

> Geen constitution-violations. Tabel bewust leeg.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
