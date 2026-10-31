# Contract: `push-send` (serverside verzendfunctie)

**Feature**: 018-push-notifications | **Datum**: 2026-10-31

## Doel

Eén serverside functie die een melding verstuurt naar **alle** apparaten van
**één** gebruiker. De risico-analysecallback is in deze feature de enige
aanroeper; taken en de mailassistent kunnen later dezelfde functie gebruiken.

## Endpoint

`POST {SUPABASE_URL}/functions/v1/push-send`

- Gedeployed met `--no-verify-jwt`: de functie is **niet** vanuit de browser
  bedoeld en heeft een eigen intern token.
- Verplichte header: `X-Push-Token: <PUSH_SEND_TOKEN>` (Supabase secret).
- `Content-Type: application/json`.

## Request

```json
{
  "user_id": "3f1c2a9e-8b7d-4c6e-9a1f-2d3e4f5a6b7c",
  "kind": "analysis_succeeded",
  "url": "/analyse/9b2f7c14-5d3e-4a61-8c02-7e5d1f3a9b40"
}
```

| Veld | Type | Verplicht | Validatie |
|---|---|---|---|
| `user_id` | UUID | ja | geldige UUID; bestaat niet → 0 ontvangers, geen fout |
| `kind` | enum | ja | `analysis_succeeded` of `analysis_failed` |
| `url` | string | ja | **relatief** pad, geen schema/host; moet per `kind` matchen op `^/analyse/<uuid>$` |

Het `url`-veld is de "adres in de app" uit de spec. De functie accepteert
uitsluitend relatieve paden die bij het `kind` passen; absolute URL's worden
geweigerd (geen open-redirect- of phishingvector via het pushkanaal). De
run-id wordt uit het pad gevalideerd en is het enige adresbestanddeel in de
payload.

## Response

Altijd `200` zodra de aanvraag geldig is — ook als geen enkele verzending
slaagde. Zo kan de callback nooit stuklopen op push.

```json
{ "ok": true, "sent": 2, "removed": 1, "failed": 0 }
```

| Veld | Betekenis |
|---|---|
| `sent` | aantal abonnementen waarvoor de pushdienst 2xx teruggaf |
| `removed` | aantal abonnementen dat als verlopen/ongeldig is verwijderd |
| `failed` | aantal overige mislukte verzendingen (rij blijft staan) |

Foutresponsen (alleen bij ongeldige aanvraag of configuratie):

| Status | Code | Wanneer |
|---|---|---|
| 400 | `VALIDATION` | ontbrekend/ongeldig veld, verkeerd `kind`, niet-relatief of niet-passend `url` |
| 401 | `UNAUTHORIZED` | ontbrekende of onjuiste `X-Push-Token` |
| 405 | `METHOD_NOT_ALLOWED` | geen POST |
| 500 | `NOT_CONFIGURED` | `VAPID_KEYS` of `VAPID_SUBJECT` ontbreekt/onleesbaar |
| 500 | `INTERNAL_ERROR` | de abonnementen konden niet worden gelezen of een onverwachte fout trad op |

```json
{ "code": "VALIDATION", "message": "Ongeldige aanroep." }
```

## Verzendgedrag

1. Lees alle rijen uit `push_subscriptions` waar `user_id` = `user_id`
   (service role; RLS omzeild).
2. Bouw één `ApplicationServer` met `VAPID_KEYS` en `VAPID_SUBJECT`.
3. Verzend **sequentiële** per abonnement:
   `server.subscribe({ endpoint, keys: { p256dh, auth } })` →
   `pushTextMessage(JSON.stringify({ kind, run_id }), { ttl: 3600, urgency: "high" })`.
4. Bij `PushMessageError` met status **404 of 410**: verwijder de rij, tel
   `removed`. Bij een andere status of een andere fout: tel `failed`, log de
   code + status + `subscription.id` + duur. **Nooit** het endpoint, de
   sleutels of klantgegevens loggen.
5. Ga altijd door met de volgende abonnementen; één fout stopt de rest niet.
6. Retourneer de aantallen.

## Garanties

- De functie gooit geen fout als de pushdienst onbereikbaar is; de respons
  blijft `200` met `failed > 0`.
- De payload bevat uitsluitend `kind` en `run_id` (zie
  `contracts/push-payload.md`).
- Verlopen abonnementen verlaten de tabel bij de eerstvolgende verzending.
- De functie doet geen retries en houdt geen wachtrij bij (minimal scope).
- De VAPID private key komt nooit in een respons, log of de frontend terecht.

## Secrets

| Secret | Gebruikt door | Doel |
|---|---|---|
| `VAPID_KEYS` | `push-send` | JSON `{ "publicKey": <JWK>, "privateKey": <JWK> }` |
| `VAPID_SUBJECT` | `push-send` | `mailto:`-contactadres voor de pushdienst |
| `PUSH_SEND_TOKEN` | `push-send` + callback | intern token; voorkomt dat gebruikers de functie aanroepen |
| `VITE_VAPID_PUBLIC_KEY` | frontend (build) | base64url raw public key voor `applicationServerKey` |

`SUPABASE_URL` en `SUPABASE_SERVICE_ROLE_KEY` zijn de bestaande
platform-secrets (zie `document-webhook`).
