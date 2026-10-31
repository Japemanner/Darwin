# Contract: push-payload en service worker

**Feature**: 018-push-notifications | **Datum**: 2026-10-31

## Payload (server → pushdienst → browser)

De volledige payload, als UTF-8 JSON, is:

```json
{ "kind": "analysis_succeeded", "run_id": "9b2f7c14-5d3e-4a61-8c02-7e5d1f3a9b40" }
```

of

```json
{ "kind": "analysis_failed", "run_id": "9b2f7c14-5d3e-4a61-8c02-7e5d1f3a9b40" }
```

**Toegestane velden**: uitsluitend `kind` en `run_id`.
**Verboden**: klantreferentie, klantgegevens, verzekeringsvraagstuk,
klantsituatie, bestandsnamen, assistentnaam, analyse-uitkomst, foutmelding,
e-mailadres of gebruikersnaam (constitution III — Google/Mozilla/Apple zijn
derde partijen).

De payload wordt versleuteld door de Web Push-laag (RFC 8291); de pushdienst
ziet alleen versleutelde bytes. Dat neemt niet weg dat de payload zelf al
minimaal moet zijn.

## Service worker (`public/sw.js`)

Scope: `/` (bestand staat in `public/`, dus `/sw.js`).

### `push`

1. Lees `event.data.json()`; is dat ongeldig, toon dan **niets** (geen
   fallback-tekst met onbekende inhoud) en log niets.
2. Titel:
   - `analysis_succeeded` → `Uw risico-analyse is gereed`
   - `analysis_failed` → `Uw risico-analyse is mislukt`
   - onbekend `kind` → geen melding.
3. `showNotification(title, { tag: run_id, data: { url: "/analyse/" + run_id } })`.
   - Geen `body` (de tekst is uitsluitend de titel).
   - `tag` = run-id: een herhaalde callback vervangt de melding in plaats van
     er een tweede naast te zetten.
   - Geen `icon`/`badge` (geen nieuwe assets in scope).
4. `event.waitUntil(...)` rond zowel het lezen als `showNotification`.

### `notificationclick`

1. `event.notification.close()`.
2. Bepaal `url = event.notification.data.url`; ontbreekt die of is het geen
   relatief `/analyse/<uuid>`-pad → niets openen.
3. `clients.matchAll({ type: "window", includeUncontrolled: true })`:
   - bestaande client → `client.navigate(url)` en `client.focus()`;
   - geen client → `clients.openWindow(url)`.
4. `event.waitUntil(...)`.

### Verboden in de service worker

- `fetch`-eventhandler (geen interceptie, geen offline-caching).
- Cache API, `localStorage`, `sessionStorage`, IndexedDB.
- `importScripts`, externe libraries of een buildstap.
- Logging van payloadinhoud.

### Registratie

`navigator.serviceWorker.register('/sw.js')` bij het openen van de
geauthenticeerde app (AppShell). Mislukt de registratie, dan blijft de rest van
de app werken en toont het gebruikersblok de status `fout` met een Nederlandse
uitleg; er is geen stille fout (constitution V).
