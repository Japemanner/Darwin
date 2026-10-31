# Data Model: Pushmeldingen voor afgeronde risico-analyses

**Feature**: 018-push-notifications | **Datum**: 2026-10-31

## Overzicht

Eén nieuwe tabel (`push_subscriptions`). Meldingen zelf worden niet opgeslagen:
ze bestaan alleen als push-payload en als systeemmelding op het apparaat.

```text
auth.users (bestaand)
   │ 1
   │
   │ n
push_subscriptions          (per gebruiker per apparaat/browserprofiel)
   ├─ id
   ├─ user_id
   ├─ endpoint        ← identificatie van het apparaat
   ├─ p256dh          ← public key van de browser
   ├─ auth            ← auth secret van de browser
   └─ created_at
```

## Entity: PushSubscription (tabel `push_subscriptions`)

| Kolom | Type | Nullable | Default | Betekenis |
|---|---|---|---|---|
| `id` | `uuid` | nee | `gen_random_uuid()` | primaire sleutel |
| `user_id` | `uuid` | nee | — | eigenaar; `REFERENCES auth.users(id) ON DELETE CASCADE` |
| `endpoint` | `text` | nee | — | push-endpoint van dit browserprofiel; uniek per gebruiker |
| `p256dh` | `text` | nee | — | base64url P-256 public key van de browser |
| `auth` | `text` | nee | — | base64url auth secret van de browser |
| `created_at` | `timestamptz` | nee | `now()` | moment van aanzetten |

**Beperkingen**

- `UNIQUE (user_id, endpoint)` — één rij per gebruiker per apparaat; dezelfde
  browser kan niet twee keer voor dezelfde gebruiker bestaan. De unieke index
  dient tegelijk als leesindex op `user_id` (prefix), dus geen extra index.
- `CHECK (endpoint ~ '^https://')` — push-endpoints zijn altijd HTTPS; dit
  voorkomt dat de server naar een onbedoeld schema fetcht.
- `CHECK (char_length(endpoint) <= 2048)` — realistische bovengrens voor
  push-endpoints (Google/Mozilla/Apple zitten ruim hieronder).
- `CHECK (p256dh <> '' AND auth <> '')` — lege sleutels zijn onbruikbaar.
- Geen `updated_at`: een abonnement wordt nooit bijgewerkt (delete + insert,
  research R5). Het huispatroon `set_updated_at` is daarom niet van toepassing.
- Geen maximum aantal abonnementen per gebruiker: de spec stelt geen grens en
  een kunstmatige limiet zou apparaten kunnen blokkeren.

**Relaties**

- `user_id` → `auth.users(id)`, `ON DELETE CASCADE`: verdwijnt een account, dan
  verdwijnen alle abonnementen mee.
- Geen relatie met `analysis_runs`: de run-id staat alleen in de push-payload,
  nooit in de tabel (constitution III — geen klant-/analysedata in deze tabel).

## RLS (verplicht, constitution + AGENTS.md)

RLS aan op de tabel. Policies:

| Operatie | Policy | Voorwaarde |
|---|---|---|
| `SELECT` | "Users can read own push subscriptions" | `auth.uid() = user_id` |
| `INSERT` | "Users can create own push subscriptions" | `auth.uid() = user_id` (WITH CHECK) |
| `DELETE` | "Users can delete own push subscriptions" | `auth.uid() = user_id` (USING) |
| `UPDATE` | geen policy (default deny) | — |

De service role (in `push-send`) omzeilt RLS bewust voor het lezen van alle
abonnementen van één gebruiker en het verwijderen van verlopen rijen.

**Verificatie**: via Supabase MCP `pg_tables WHERE rowsecure = false` (F-01) en
een expliciete test dat gebruiker A de rijen van gebruiker B niet kan lezen,
aanmaken of verwijderen (RLS-check in quickstart §4). De bestaande
`scripts/rls-verify.mjs` wordt niet uitgebreid: dat script dekt de
beheerders-only write-regels van feature 010, niet deze tabel.

## Entity: PushNotification (niet opgeslagen)

| Veld | Type | Verplicht | Betekenis |
|---|---|---|---|
| `kind` | `'analysis_succeeded' \| 'analysis_failed'` | ja | bepaalt de vaste Nederlandse tekst |
| `run_id` | `uuid` | ja | bepaalt `/analyse/<run-id>` bij een klik |

**Validatieregels**

- `kind` moet in de lijst staan; onbekende waarden → 400.
- `run_id` moet een geldige UUID zijn.
- De payload naar de pushdienst bevat **uitsluitend** deze twee velden.
- Geen klantreferentie, klantgegevens, vraagstuk, bestandsnamen,
  analyse-uitkomst of assistentnaam — ook niet als leeg veld.

**Meldingsteksten (vast, Nederlands)**

| `kind` | Titel van de systeemmelding | Klikbestemming |
|---|---|---|
| `analysis_succeeded` | `Uw risico-analyse is gereed` | `/analyse/<run-id>` |
| `analysis_failed` | `Uw risico-analyse is mislukt` | `/analyse/<run-id>` |

Er is geen body-tekst: de meldingstekst is uitsluitend de titel, zoals de spec
voorschrijft.

## Statusmachine van het gebruikersblok

De status wordt per paginaweergave afgeleid uit (a) browserondersteuning,
(b) `Notification.permission`, (c) `pushManager.getSubscription()` en (d) het
bestaan van de eigen rij voor die `endpoint`.

```text
                 ┌──────────────────┐
                 │   determining    │  (eerste meting)
                 └────────┬─────────┘
        ┌─────────────────┼──────────────────┬─────────────────┐
        ▼                 ▼                  ▼                 ▼
  unsupported         blocked             off               on
  (geen PushManager/  (permission         (geen rij of      (rij + browser-
   Notification)       === 'denied')       geen subscription) subscription)
        │                 │                  │                 │
        │                 │      klik "aanzetten"               │ klik "uitzetten"
        │                 │                  ▼                 ▼
        │                 │             requesting ──────► off / error
        │                 │                  │
        │                 │                  ▼
        │                 │                on / error
        ▼                 ▼                  ▼
   uitleg (tekst)    uitleg (tekst)     foutmelding + blijft off
```

- `unsupported` en `blocked` tonen **geen** knop, alleen Nederlandse uitleg.
- `on` toont de knop "Meldingen uitzetten" en de tekst dat meldingen op dit
  apparaat aan staan.
- Een fout bij aanzetten of uitzetten leidt tot `error` met een Nederlandse
  melding; de knop blijft bruikbaar.
- Bij het opnieuw focussen van het venster of het openen van de app wordt de
  status opnieuw bepaald (de toestemming kan in de browserinstellingen zijn
  gewijzigd).

## Levenscyclus van een abonnement

| Gebeurtenis | Actie |
|---|---|
| Adviseur klikt "Meldingen aanzetten" en verleent toestemming | browser-subscription + `INSERT` eigen rij |
| Adviseur klikt "Meldingen uitzetten" | `subscription.unsubscribe()` + `DELETE` eigen rij |
| Adviseur logt uit | idem, vóór `auth.signOut()`; mislukken blokkeert uitloggen niet |
| Pushdienst meldt 404 of 410 bij verzending | `push-send` verwijdert de rij |
| Pushdienst meldt een andere fout | rij blijft; fout wordt gelogd (code + aantallen) |
| Account verwijderd | `ON DELETE CASCADE` verwijdert de rijen |
| Browsergegevens gewist | endpoint bestaat niet meer; volgende verzending → 404/410 → rij weg |
