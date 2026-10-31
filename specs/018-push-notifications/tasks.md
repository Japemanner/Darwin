---

description: "Task list for feature 018 — pushmeldingen voor afgeronde risico-analyses"
---

# Tasks: Pushmeldingen voor afgeronde risico-analyses

**Input**: Design documents from `/specs/018-push-notifications/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: vereist door de spec (FR-020: Playwright voor aanzetten, uitzetten en
geweigerde toestemming) en door het plan (Node-unit tests voor de send-logica).
Tests worden per verhaal **eerst** geschreven en moeten falen vóór de
implementatie.

**Organization**: taken zijn gegroepeerd per user story (US1–US4) zodat elk
verhaal afzonderlijk implementeerbaar en testbaar is.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallel uitvoerbaar (ander bestand, geen onderlinge afhankelijkheid)
- **[Story]**: US1, US2, US3 of US4
- Bestandspaden zijn exact en relatief aan de repository-root

## Path Conventions

Single-project SPA + Supabase Edge Functions (zie plan.md
"Project Structure"): `src/`, `tests/`, `public/`, `supabase/`, `scripts/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Eenmalige tooling en configuratie die geen enkel verhaal blokkeert.

- [X] T001 [P] Maak `scripts/generate-vapid-keys.mjs`: genereer met Node Web Crypto een ECDSA P-256-sleutelpaar, print `VAPID_KEYS` (JWK JSON), `VAPID_PUBLIC_KEY` (base64url raw) en `VAPID_SUBJECT`-voorbeeld; geen dependencies toevoegen
- [X] T002 [P] Voeg `VITE_VAPID_PUBLIC_KEY?: string` toe aan `ImportMetaEnv` in `src/vite-env.d.ts` en een placeholder met uitleg toe aan `.env.example`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database, types en de callback-gate. Zonder deze fase kan geen
enkel verhaal zijn werk doen.

**⚠️ CRITICAL**: US1–US4 starten pas na deze fase.

- [X] T003 **Gate**: controleer via Supabase MCP of `analysis-run-callback` in het project bestaat (functielijst + bron/deployment); leg datum, projectref en ja/nee vast in `specs/018-push-notifications/quickstart.md` §0. Bij "nee": geen backend nabouwen — de afhankelijkheid wordt in T030 gedocumenteerd — **uitkomst 2026-10-31: NEE** (projectref `ddfjigrjwlfpaljhhogv`; geen functie, geen `analysis`-tabel)
- [X] T004 Maak `supabase/migrations/019_push_subscriptions.sql`: tabel `push_subscriptions` (`id`, `user_id` FK `auth.users` ON DELETE CASCADE, `endpoint`, `p256dh`, `auth`, `created_at`), `UNIQUE (user_id, endpoint)`, CHECKs uit `data-model.md`, `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` en de drie policies (SELECT/INSERT/DELETE, `auth.uid() = user_id`); geen UPDATE-policy
- [X] T005 Pas migratie 019 toe via Supabase MCP en verifieer `rowsecurity = true` + exact drie policies (`pg_tables` / `pg_policies`); noteer het resultaat voor FITNESS.md — remote versie `20261031154614`, 3 policies, geen UPDATE-policy
- [X] T006 Werk `src/types/database.types.ts` bij met `push_subscriptions` (Row/Insert/Update/Relationships) conform de toegepaste migratie
- [X] T007 [P] Maak `src/lib/push/types.ts`: `PushKind` (`analysis_succeeded` | `analysis_failed`), `PushStatus` (`determining` | `unsupported` | `blocked` | `off` | `on` | `working` | `error`), `PushErrorCode` en de vaste Nederlandse teksten als constanten
- [ ] T008 Zet de server-secrets via Supabase: `VAPID_KEYS`, `VAPID_SUBJECT`, `PUSH_SEND_TOKEN` (waarde uit T001 / `openssl rand -hex 32`); zet `VITE_VAPID_PUBLIC_KEY` in `.env.local` en in Netlify; controleer dat geen van deze waarden in de repo staat — **server-secrets + `.env.local` klaar (2026-10-31, via Management API want de CLI 2.102 weigert het `sbp_v0_…`-tokenformaat); Netlify-envvar nog open**

**Checkpoint**: tabel + RLS + types + secrets staan; elk verhaal kan beginnen.

---

## Phase 3: User Story 1 — Meldingen aanzetten voor dit apparaat (P1) 🎯 MVP

**Goal**: De adviseur zet in het gebruikersblok meldingen aan voor dit apparaat
en ziet/ziet dat de status "aan" is; hij kan ze weer uitzetten.

**Independent Test**: Inloggen als adviseur, in het gebruikersblok op
"Meldingen aanzetten" klikken, toestemming verlenen → status "aan" en blijft
"aan" na herladen; opnieuw klikken → status "uit" en de rij is weg.

### Tests for User Story 1 ⚠️ (eerst schrijven, moet falen)

- [X] T009 [P] [US1] Maak `tests/e2e/push-notifications.spec.ts` met de US1-tests: `test.use({ permissions: ['notifications'] })`, een `addInitScript`-stub voor `PushManager.subscribe`/`getSubscription` en `PushSubscription.unsubscribe` (research R8), asserties op de knoplabels, de statustekst en persistentie na `page.reload()`; gebruik de `memberPage`-fixture uit `tests/e2e/fixtures.ts`

### Implementation for User Story 1

- [X] T010 [P] [US1] Maak `public/sw.js` met alleen een `activate`-handler (`self.skipWaiting()`/`clients.claim()`); nog geen push- of click-handler, geen fetch-handler, geen cache
- [X] T011 [US1] Implementeer `src/lib/push/client.ts`: supportdetectie (`serviceWorker`, `PushManager`, `Notification`), permissiestatus, base64url → `Uint8Array` (via `atob`, **geen** `crypto.subtle` — fitness F-18), `registerServiceWorker()`, `subscribeThisDevice(userId)` (browser-subscribe, daarna `DELETE` + `INSERT` op `push_subscriptions`), `unsubscribeThisDevice(userId)` en `readThisDeviceState(userId)` (browser-subscription + eigen rij)
- [X] T012 [US1] Implementeer `src/hooks/usePushSubscription.ts`: statusmachine uit `data-model.md`, `enable()`/`disable()` met foutafhandeling, en hercontrole bij mount; geeft `{ status, errorCode, enable, disable }` terug
- [X] T013 [P] [US1] Maak `src/components/layout/PushNotificationControl.tsx`: echte `<button>` met Nederlandse labels ("Meldingen aanzetten" / "Meldingen uitzetten"), statustekst, `aria-live="polite"` op de status, zichtbare focusstate; nog geen blocked/unsupported-varianten (die komen in US3)
- [X] T014 [US1] Rendere de control in **beide** gebruikersblokken van `src/components/layout/AppShell.tsx` (mobiele overlay + desktop aside) en registreer de service worker bij mount van de geauthenticeerde shell
- [ ] T015 [US1] Voer T009 uit tegen de implementatie tot groen; controleer handmatig dat de rij in `push_subscriptions` verschijnt en na uitzetten verdwijnt

**Checkpoint**: US1 werkt zelfstandig; de MVP is demonstreerbaar (abonneren/afmelden).

---

## Phase 4: User Story 2 — Systeemmelding bij afronding of mislukken (P1)

**Goal**: Een afgeronde of mislukte analyse levert een systeemmelding op elk
apparaat met meldingen aan, ook met de app gesloten; een klik opent
`/analyse/<run-id>`.

**Independent Test**: Met de handmatige rooktest uit `quickstart.md` §5: melding
aanzetten, analyse starten, app sluiten, wachten → melding met de exacte tekst;
klik opent de juiste analyse; `push-send` los aanroepen met curl geeft
`{ok:true,...}`.

### Tests for User Story 2 ⚠️ (eerst schrijven, moet falen)

- [X] T016 [P] [US2] Maak `supabase/functions/push-send/logic.test.ts` (`node --test`): geldige invoer; ongeldige `kind`; absolute URL; URL die niet bij `kind` past; payload bevat exact `kind` + `run_id`; 404/410 → `removed`; 500 → `failed` zonder throw; geen endpoint/sleutels in logregels

### Implementation for User Story 2

- [X] T017 [P] [US2] Implementeer `supabase/functions/push-send/logic.ts` (pure, geen Deno-API's): `validateRequest()`, `runIdFromUrl()`, `buildPayload()`, `isGoneStatus()` (404 + 410) en `deliver(subscriptions, push, onGone, onError)` met geïnjecteerde pushfunctie
- [X] T018 [US2] Implementeer `supabase/functions/push-send/index.ts`: `Deno.serve`, `X-Push-Token`-check, `VAPID_KEYS`/`VAPID_SUBJECT` laden via `jsr:@negrel/webpush`, service-role client, abonnementen lezen, sequentieel verzenden, 404/410 verwijderen, altijd `200 {ok,sent,removed,failed}`, logs zonder klantgegevens (contract `contracts/push-send.md`)
- [X] T019 [US2] Deploy `push-send` (`supabase functions deploy push-send --no-verify-jwt`) en voer de R1-verificatie uit: één echte subscription + curl-aanroep, controleer de logs op crypto-fouten; bij falen: fallback naar `@block65/webcrypto-web-push` (alleen dan) — **gedeployed als versie 1 (ACTIVE, `verify_jwt: false`) via de Management API; R1-smoke met een synthetische rij gaf `200 {sent:0,removed:0,failed:1}` + `SEND_FAILED` in de logs, geen crypto-fout, geen fallback nodig**
- [X] T020 [US2] Voeg aan `public/sw.js` de `push`- en `notificationclick`-handlers toe volgens `contracts/push-payload.md` (exacte teksten, `tag` = run-id, geen body, geen fetch/cache/opslag, `clients.matchAll` + `navigate`/`openWindow`)
- [X] T021 [US2] Pas de callback-integratie toe volgens `contracts/analysis-callback-integration.md` **als** T003 "ja" opleverde: alleen na een echte statusovergang, `advisor_id` uit de run-rij, 5 s timeout, fouten opvangen en loggen zonder klantgegevens. Bij "nee": taak afronden als gedocumenteerde afhankelijkheid (geen code in deze repo) — **T003 = nee, dus afgesloten als gedocumenteerde afhankelijkheid; geen code toegevoegd**
- [ ] T022 [US2] Handmatige rooktest `quickstart.md` §5: melding bij gereed én mislukt, app gesloten, klik opent `/analyse/<run-id>`, tweede callback levert geen tweede melding (tag)

**Checkpoint**: US1 + US2 leveren de kernwaarde; end-to-end aantoonbaar (of US2 expliciet geblokkeerd door een ontbrekende callback).

---

## Phase 5: User Story 3 — Duidelijke uitleg in plaats van een dode knop (P1)

**Goal**: Bij geweigerde toestemming of ontbrekende browserondersteuning ziet de
adviseur een Nederlandse uitleg zonder werkende knop.

**Independent Test**: Weiger de toestemming (of simuleer die) → uitleg, geen
knop; simuleer een browser zonder `PushManager` → uitleg, geen knop; herstel de
toestemming → de knop verschijnt weer.

### Tests for User Story 3 ⚠️ (eerst schrijven, moet falen)

- [X] T023 [P] [US3] Breid `tests/e2e/push-notifications.spec.ts` uit: geweigerde toestemming (override van `Notification.permission` op `'denied'`) → Nederlandse uitleg en géén knop; niet-ondersteund (override `window.PushManager` naar `undefined`) → Nederlandse uitleg en géén knop

### Implementation for User Story 3

- [X] T024 [US3] Breid `src/components/layout/PushNotificationControl.tsx` uit met de varianten `blocked`, `unsupported`, `determining` en `error`, elk met eigen Nederlandse uitleg (tutoyeren noch jargon); geen knop bij `blocked`/`unsupported`; bij `error` een foutmelding en een werkende retry-knop
- [X] T025 [US3] Voeg in `src/hooks/usePushSubscription.ts` hercontrole toe bij `visibilitychange`/`focus`, zodat een in de browserinstellingen gewijzigde toestemming zonder herladen zichtbaar wordt
- [X] T026 [US3] Controleer WCAG 2.1 AA: toetsenbordbereikbaarheid, zichtbare focus, status als tekst (niet kleur-only), `aria-live` kondigt wijzigingen aan; leg de controle vast in het opleververslag

**Checkpoint**: Alle drie de P1-verhalen werken; geen enkele combinatie toont een dode knop.

---

## Phase 6: User Story 4 — Uitloggen stopt meldingen op dit apparaat (P2)

**Goal**: Na uitloggen ontvangt dit apparaat geen meldingen meer voor de
uitgelogde gebruiker; andere apparaten blijven werken.

**Independent Test**: Meldingen aanzetten, uitloggen, analyse laten afronden →
geen melding op dit apparaat; op een tweede apparaat met meldingen aan komt de
melding wel.

### Tests for User Story 4 ⚠️

- [X] T027 [P] [US4] Voeg aan `tests/e2e/push-notifications.spec.ts` een test toe: meldingen aan → uitloggen → opnieuw inloggen → status "uit"; en de stub-subscription is geünsubscribed

### Implementation for User Story 4

- [X] T028 [US4] Pas `signOut` in `src/store/authStore.ts` aan: verwijder eerst het abonnement van dit apparaat (rij + `subscription.unsubscribe()`), daarna `supabase.auth.signOut()`; faalt het opruimen, dan gaat uitloggen door en wordt de fout zonder klantgegevens gelogd
- [ ] T029 [US4] Verifieer handmatig dat een tweede apparaat na uitloggen op apparaat A gewoon meldingen blijft ontvangen

**Checkpoint**: Alle vier de verhalen zijn afzonderlijk aantoonbaar.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T030 [P] Werk `FEATURES.md` bij met de feature, de nieuwe tabel, de send-functie en **expliciet** de callback-afhankelijkheid (T003-uitkomst)
- [X] T031 [P] Werk `specs/018-push-notifications/quickstart.md` bij met de werkelijke T003-uitkomst, de gebruikte secrets en eventuele afwijkingen; controleer `.env.example`
- [ ] T032 Draai `npx tsc --noEmit`, `bash scripts/fitness-check.sh` en de volledige Playwright-regressie; alle bestaande tests blijven groen (FR-020) — **`tsc` schoon, fitness 0 fail / 2 warn / 4 skip; Playwright 86 skipped (0 failed) omdat `E2E_EMAIL`/`E2E_PASSWORD`/`E2E_MEMBER_*` ontbreken**
- [X] T033 [P] Controleer dat de VAPID private key, `PUSH_SEND_TOKEN` en service-role key nergens in `src/`, `public/` of de repo staan (Gitleaks + handmatige grep); bevestig dat `src/` geen `crypto.subtle` bevat (F-18)
- [X] T034 [P] Controleer de payload- en loghygiëne: precies twee payloadvelden, geen endpoint/sleutels/klantgegevens in logs, geen fetch-handler of opslag in `public/sw.js`
- [ ] T035 Werk de agent-context (`AGENTS.md` SPECKIT-blok) bij naar het definitieve plan en commit met een conventioneel bericht

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: geen dependencies, start direct
- **Foundational (Phase 2)**: na Setup; **blokkeert alle verhalen**
- **US1 (Phase 3)**: na Foundational; geen dependency op andere verhalen
- **US2 (Phase 4)**: na Foundational; gebruikt de abonnementen uit US1 voor de
  end-to-end rooktest, maar de send-functie en unit-tests zijn onafhankelijk
  implementeerbaar
- **US3 (Phase 5)**: na Foundational; breidt de component uit US1 uit, de
  uitlegvarianten zijn los testbaar
- **US4 (Phase 6)**: na US1 (heeft een abonnement nodig om op te ruimen)
- **Polish (Phase 7)**: na alle gewenste verhalen

### Kritieke pad

```text
T003 (callback-gate) ─┐
T004 → T005 → T006 ───┼→ T007/T008 → T009 → T011 → T012 → T014 → T015
                      │                                     │
                      │                                     ├→ T016→T017→T018→T019→T020→T022
                      │                                     ├→ T023→T024→T025→T026
                      │                                     └→ T027→T028→T029
                      └──────────────────────────────────────→ T021 (alleen bij "ja")
```

### Binnen elk verhaal

1. Tests schrijven en **laten falen**
2. Implementatie
3. Verhaal-specifieke checkpoint halen
4. Pas daarna verder met de volgende prioriteit

### Parallel Opportunities

- T001 en T002 (Setup)
- T007 naast T004–T006 (types zijn een eigen bestand)
- T009 (tests) naast T010 (lege service worker)
- T013 (component) naast T011/T012, mits de hook-interface eerst is afgesproken
- T016/T017 (unit tests + pure logica) volledig los van de frontend
- T023 (US3-tests) naast T016–T022
- T030, T031, T033, T034 in de polishfase

---

## Parallel Example: User Story 2

```text
# Tests en pure logica kunnen tegelijk:
Task: "T016 unit tests in supabase/functions/push-send/logic.test.ts"
Task: "T017 pure logica in supabase/functions/push-send/logic.ts"

# Daarna serieel:
T018 index.ts → T019 deploy/rooktest → T020 sw.js handlers → T021 callback-hook → T022 handmatige rooktest
```

---

## Implementation Strategy

### MVP eerst (US1 + US2)

1. Phase 1 + Phase 2 afronden (inclusief de callback-gate)
2. US1: abonneren/afmelden werkend en getest
3. US2: send-functie + service worker + rooktest
4. **STOP en VALIDEER**: `quickstart.md` §5 doorlopen
5. Daarna US3 en US4

### Incrementele oplevering

- Na US1: de adviseur kan zich aan- en afmelden (zichtbaar, maar nog geen push)
- Na US2: de kernwaarde (melding bij gereed/mislukt)
- Na US3: eerlijke uitleg op elke browser/toestemmingscombinatie
- Na US4: privacy op gedeelde apparaten

### Als T003 "nee" oplevert

US1, US3 en US4 zijn volledig opleverbaar en testbaar. US2 is opleverbaar tot en
met de send-functie en de service worker; alleen de callback-hook wacht op het
backend dat `analysis-run-callback` beheert. Dat wordt in FEATURES.md en het
opleververslag als openstaande afhankelijkheid vermeld — niet als "klaar".

---

## Notes

- [P] = ander bestand, geen onderlinge afhankelijkheid
- Elke taak noemt het exacte bestandspad
- Commit na elke taak of logische groep met een conventioneel bericht
  (`feat(push): ...`, `feat(db): ...`, `test(push): ...`)
- Geen taak voegt een dependency toe buiten `jsr:@negrel/webpush` (server) —
  de frontend krijgt geen nieuwe npm-package
- De service worker blijft zonder fetch-handler, cache en browseropslag
  (constitution III); elke taak die dat raakt is een bug, geen keuze
