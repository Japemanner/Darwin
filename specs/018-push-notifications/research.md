# Research: Pushmeldingen voor afgeronde risico-analyses

**Feature**: 018-push-notifications | **Datum**: 2026-10-31

## R1. Web Push-bibliotheek in de Supabase Edge Runtime

- **Decision**: gebruik `jsr:@negrel/webpush@0.5.0` (Deno-native, Web Crypto,
  RFC 8291 + RFC 8292). `npm:web-push` wordt niet gebruikt.
- **Rationale**: `npm:web-push` leunt op Node's legacy
  `crypto.createECDH`; de Deno-runtime ondersteunt die API niet, waardoor elke
  verzending faalt met `Not implemented: crypto.ECDH` (zie ook het
  Supabase-communitypatroon in de geraadpleegde edge-function-documentatie).
  `@negrel/webpush` gebruikt uitsluitend `crypto.subtle`, werkt op Deno,
  Cloudflare Workers, Bun en browsers, staat op JSR (dat Supabase Edge Functions
  native ondersteunen — de eigen `supabase-js`-import gebruikt hetzelfde
  mechanisme) en heeft alleen `@std/*` + `http-ece` als afhankelijkheden.
- **API-bewijs** (bron: JSR-documentatie en `subscriber.ts`):
  - `importVapidKeys({ publicKey: JsonWebKey, privateKey: JsonWebKey })`
  - `ApplicationServer.new({ contactInformation, vapidKeys })`
  - `server.subscribe({ endpoint, keys: { p256dh, auth } })`
  - `pushTextMessage(text, { ttl, urgency })` → `Promise<void>`
  - bij een niet-2xx respons gooit de bibliotheek `PushMessageError` met
    `response.status`; `isGone()` dekt alleen 410, dus de aanroeper behandelt
    **404 én 410** als verlopen (web-push-conventie).
- **Alternatives considered**:
  - `npm:web-push`: verworpen — Node-crypto, werkt niet in de Edge Runtime.
  - `@block65/webcrypto-web-push` via `esm.sh?target=deno`: werkt op Web
    Crypto en is in een ander Supabase-project bewezen, maar vereist een
    externe CDN-import en levert alleen een payload-bouwer (geen
    abonnementsabstractie). Blijft de fallback als R1 in de deploy-smoke faalt.
  - Zelf RFC 8291 implementeren: verworpen — crypto-risico en onderhoudslast.

**Verificatiestap (verplicht vóór de rest van Phase A)**: deploy `push-send`
met een minimale invoer en één echte subscription; controleer in de
Edge Function-logs dat er geen `crypto`-fout optreedt en dat de pushdienst een
2xx geeft. Bij falen: stap over op `@block65/webcrypto-web-push`.

## R2. Waarom geen Firebase SDK en geen web app manifest

- **Decision**: rechtstreeks `PushManager.subscribe()` met een VAPID
  `applicationServerKey`; geen Firebase SDK, geen `manifest.webmanifest`, geen
  installatieprompt.
- **Rationale**: Chrome/Edge (Chromium) en Firefox op desktop ondersteunen Web
  Push zonder installatie; Chrome op Android ook. Safari op macOS ondersteunt
  Web Push sinds Safari 16 voor gewone websites. iOS/iPadOS valt buiten scope
  (vereist wél installatie op het beginscherm). Een manifest voegt niets toe aan
  de werking en is expliciet buiten scope (constitution VI).
- **Alternatives considered**: Firebase Cloud Messaging (verworpen — extra SDK,
  Google-afhankelijkheid en een tokenmodel naast VAPID); PWA-manifest
  (verworpen — niet nodig voor push, buiten scope).

## R3. Waar de analysecallback leeft

- **Decision**: `push-send` wordt in deze repository gebouwd en
  gedeployed; de callback-integratie wordt als contract vastgelegd en pas
  toegepast nadat via Supabase MCP is vastgesteld waar
  `analysis-run-callback` draait.
- **Rationale**: de repository bevat geen `analysis_runs`-migratie en geen
  `analysis-run-callback`-functie. Spec 008 (research R3) beschrijft het echte
  analyse-backend als een latere, aparte backend-feature; de UI draait tegen
  `scripts/mock-analysis-server.mjs`. De callback kan dus buiten deze repo
  leven of nog niet bestaan. Er wordt geen backend verzonnen.
- **Alternatives considered**: callback in deze repo nabouwen (verworpen —
  buiten scope, vereist het volledige 008-backendcontract); meldingen direct
  vanuit de UI sturen (verworpen — vereist de private key in de browser).

## R4. Abonnementen: directe tabeltoegang met RLS

- **Decision**: de client schrijft en verwijdert zijn eigen rijen rechtstreeks
  in `push_subscriptions` via `supabase-js`; RLS beperkt alles tot
  `auth.uid() = user_id`. Verzenden gebeurt met de service role in `push-send`.
- **Rationale**: de spec eist letterlijk "een gebruiker leest, maakt en
  verwijdert alleen eigen abonnementen"; RLS is daar het directe middel voor en
  scheelt een extra Edge Function. De bestaande fitness-check F-01/F-10
  verifieert RLS via Supabase MCP.
- **Alternatives considered**: subscription-CRUD via een Edge Function
  (verworpen — extra hop en functie zonder meerwaarde); abonnementen in
  `profiles` opslaan (verworpen — 1-op-veel, geen RLS per apparaat).

## R5. Idempotent aanzetten zonder UPDATE-policy

- **Decision**: bij aanzetten eerst `DELETE` op `(user_id, endpoint)`, daarna
  `INSERT`. Geen UPDATE-policy.
- **Rationale**: de spec noemt alleen lezen, maken en verwijderen. Een upsert
  zou een UPDATE-policy vereisen (PostgREST `ON CONFLICT DO UPDATE`), wat de
  RLS-oppervlakte vergroot. Omdat de browser bij een bestaand abonnement
  dezelfde `endpoint` teruggeeft, is delete+insert idempotent; mislukt de
  insert, dan blijft de browser-subscription bestaan en kan de gebruiker
  opnieuw klikken.
- **Alternatives considered**: `upsert(..., { ignoreDuplicates: true })`
  (verworpen — veroudert sleutels nooit en verbergt fouten);
  `INSERT ... ON CONFLICT DO UPDATE` (verworpen — UPDATE-policy buiten spec).

## R6. Payload en deep link

- **Decision**: de push-payload is exact
  `{"kind":"analysis_succeeded"|"analysis_failed","run_id":"<uuid>"}`. De
  service worker vertaalt `kind` naar de vaste Nederlandse titel en bouwt de
  klik-URL als `/analyse/<run_id>`.
- **Rationale**: spec FR-006 staat alleen soort en run-id toe; de run-id is
  tevens het enige adresbestanddeel (`/analyse/:runId`, bestaande route). De
  send-functie accepteert als invoer wél een `url` (contract voor latere
  soorten), maar staat alleen relatieve paden toe die per `kind` matchen; de
  run-id wordt daaruit gevalideerd. Zo kan de push-kanaal nooit als open
  redirect of phishing-vector worden gebruikt.
- **Alternatives considered**: volledige URL in de payload (verworpen — meer
  dan soort + run-id, en introduceert een arbitrary-URL-risico); alleen
  `run_id` zonder `kind` (verworpen — de tekst moet uit de payload volgen).

## R7. Service worker: alleen tonen en openen

- **Decision**: `public/sw.js`, geregistreerd met scope `/`; alleen
  `push` en `notificationclick`. Geen `fetch`-handler, geen Cache API, geen
  `localStorage`/IndexedDB.
- **Rationale**: spec FR-016 en constitution III. Een `fetch`-handler zou de
  app offline-gedrag geven dat niet is gevraagd en de update-cyclus compliceren.
  `tag: run_id` voorkomt dubbele meldingen bij een herhaalde callback.
- **Alternatives considered**: Workbox/vite-plugin-pwa (verworpen — extra
  dependency en caching die buiten scope is); SW in `src/` via bundler
  (verworpen — dan is de scope/het pad niet stabiel en is er een buildstap
  nodig).

## R8. Teststrategie zonder echte pushdienst

- **Decision**:
  - Playwright: `test.use({ permissions: ['notifications'] })` voor de
    toestemming, plus een `addInitScript`-stub van `PushManager.subscribe`,
    `getSubscription` en `PushSubscription.unsubscribe`. Weigeren en
    niet-ondersteund worden gesimuleerd via `Notification.permission` /
    `window.PushManager`-overrides.
  - Send-functie: pure `logic.ts` getest met `node --test` (Node 24 strips
    types), met een geïnjecteerde `fetch`/pushfunctie — geen netwerk, geen
    Supabase.
- **Rationale**: echte pushbezorging vereist een pushdienst en een
  geïnstalleerde browser; in headless Chromium faalt `subscribe()` vaak. De
  gebruiker gaf expliciet opdracht tot deze splitsing. De stub test de
  UI-statusmachine en de DB-koppeling; de unit-tests dekken de
  protocolonafhankelijke logica (validatie, payload, 404/410, foutpaden).
- **Alternatives considered**: echte push in CI (verworpen — niet
  deterministisch, vereist externe diensten en credentials); alleen
  unit-tests (verworpen — de spec eist Playwright-dekking voor aan/uit/weigeren).

## R9. VAPID-sleutelbeheer

- **Decision**: éénmalig genereren met `scripts/generate-vapid-keys.mjs`
  (Node Web Crypto, ECDSA P-256). Opslag:
  - Supabase secrets: `VAPID_KEYS` (JSON `{publicKey, privateKey}` in JWK),
    `VAPID_SUBJECT` (`mailto:`-adres), `PUSH_SEND_TOKEN` (intern token tussen
    callback en `push-send`).
  - Frontend: `VITE_VAPID_PUBLIC_KEY` (base64url, raw public key) — openbaar,
    deployment-breed, per omgeving instelbaar.
- **Rationale**: `@negrel/webpush` importeert JWK; de browser heeft de raw
  base64url-vorm nodig als `applicationServerKey`. De private key verlaat de
  server nooit. `PUSH_SEND_TOKEN` voorkomt dat een gewone gebruiker de
  service-role-functie kan aanroepen.
- **Alternatives considered**: publieke sleutel uit de database/Edge Function
  halen (verworpen — extra endpoint/tabel voor een niet-geheim dat de browser
  bij elke subscribe nodig heeft); sleutel in de broncode hardcoden
  (verworpen — rotatie vereist codewijziging en per-omgeving verschillen
  worden onmogelijk).
