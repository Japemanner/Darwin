# Contract: `analysis-run-submit` (browser → Darwin → n8n)

**Feature**: 021-analysis-server-route | **Datum**: 2026-10-31
**Basis**: `specs/008-risico-analyse-ui/contracts/n8n-submit.md`, met de afwijkingen
uit de technische route van 021 (JSON + base64 naar n8n, centrale catalogus-URL).

## Endpoint

`POST {SUPABASE_URL}/functions/v1/analysis-run-submit`

- Aanroep door de browser via `supabase.functions.invoke('analysis-run-submit', { body: FormData })`.
- Verificatie van het Supabase-JWT gebeurt door de functie zelf (`auth.getUser`), niet
  via de platform-JWT-verificatie; deploy daarom **met** JWT-verificatie (standaard).
- Fail-closed CORS volgens het `rag-chat`-patroon (`ALLOWED_ORIGINS`, nooit `*`).

## Request

`Content-Type: multipart/form-data` (de browser zet de boundary; de client zet géén
eigen Content-Type).

| Onderdeel | Type | Verplicht | Validatie |
|---|---|---|---|
| `run_id` | text (UUID) | ja | UUID-formaat; nog niet bestaand |
| `assistant_id` | text (UUID) | ja | bestaand, actief, type `risico_analyse`, eigen organisatie |
| `verzekeringsvraagstuk` | text | ja | non-empty na trim |
| `kennisbronnen` | text (JSON-array) | ja | minimaal één; elk `id` gekoppeld aan de assistent én de kennisbron hoort bij de organisatie |
| `klantsituatie` | text | nee | — |
| `bestanden` | file[] | nee | pdf/docx/txt; ≤ 10 MB per bestand; ≤ 25 MB totaal |
| `urls` | text (JSON-array) | nee | elk `https://` |
| `klant_ref` | text | ja | non-empty na trim |

Groepsregel: minimaal één van `klantsituatie`, `bestanden` of `urls` is gevuld.

De velden `advisor_id` en `adviseur` worden niet geaccepteerd als gezaghebbende invoer:
de server negeert ze en gebruikt `auth.uid()` + `profiles.full_name`.

## Serverstappen

1. CORS + methodecontrole (POST; OPTIONS → 200).
2. JWT → `auth.getUser`; geen gebruiker → 401 `UNAUTHORIZED`.
3. `profiles` van `auth.uid()` → `organization_id` en `full_name`; geen profiel/org →
   403 `FORBIDDEN`.
4. `ai_assistants` van de assistent: moet bestaan, `is_active = true`,
   `type = 'risico_analyse'` en `organization_id` = de org uit stap 3; anders 403
   `FORBIDDEN`.
5. Catalogus + centrale koppeling met de service role:
   `assistant_catalog.prod_webhook_url` via `ai_assistants.catalog_id`;
   `platform_webhook_config.auth_header` en `.token` (rij `id = true`).
   Geen/ongeldige URL → 400 `NOT_CONFIGURED` (**geen rij aanmaken**).
6. Bestands- en veldvalidatie; bij een te grote upload of te veel bytes → 413
   `FILE_TOO_LARGE`; verkeerd type → 400 `VALIDATION`; groepsregel → 422
   `GROUP_VALIDATION`; ongeldige kennisbron (niet gekoppeld aan de assistent of niet van
   de organisatie) → 400 `VALIDATION`.
7. `analysis_runs` invoegen met de service role: `status = 'queued'`,
   `started_at = now()`, `expires_at = now() + interval '7 days'`. Een bestaande
   `run_id` → 409 `CONFLICT` (geen tweede rij).
8. `callback_url` opbouwen:
   `{SUPABASE_URL}/functions/v1/analysis-run-callback?run_id={run_id}&sig={hmac}`,
   waarbij `hmac = hex(HMAC-SHA256(ANALYSIS_CALLBACK_SECRET, run_id))`.
9. JSON naar n8n sturen (zie hieronder), met de centrale header alleen als het token
   niet leeg is, en met een time-out van 30 s.
10. n8n **202** → rij bijwerken naar `running`; antwoord 202 `{ run_id }`.
    Elke andere status, time-out of netwerkfout → rij bijwerken naar `failed` met
    `error_code` (`UPSTREAM_AUTH`, `UPSTREAM_ERROR`, `UPSTREAM_TIMEOUT`,
    `UPSTREAM_UNREACHABLE`), `error_message` (Nederlands) en `finished_at`; antwoord
    met de bijbehorende HTTP-status en `{ code, message }`.

## n8n-payload (JSON)

```json
{
  "run_id": "uuid",
  "callback_url": "https://<project>.supabase.co/functions/v1/analysis-run-callback?run_id=uuid&sig=<hex>",
  "verzekeringsvraagstuk": "…",
  "kennisbronnen": [{ "id": "uuid", "name": "…" }],
  "klantsituatie": "…",
  "bestanden": [{ "naam": "polis.pdf", "type": "application/pdf", "data": "<base64>" }],
  "urls": ["https://…"],
  "klant_ref": "…",
  "adviseur": "Voorletters Achternaam"
}
```

- `adviseur` is een platte string (`String(body.adviseur)` in de flow).
- `kennisbronnen` worden server-side geresolveerd; de clientnaam wordt niet gebruikt.
- Bestanden worden per stuk met `encodeBase64` omgezet en daarna direct losgelaten.
- n8n ontvangt nooit het Supabase-JWT, de organisatie-id of het centrale secret.

## Response

```json
HTTP 202 Accepted
{ "run_id": "uuid" }
```

## Fouten

| Status | Code | Betekenis | UI-gedrag |
|---|---|---|---|
| 400 | `VALIDATION` | ongeldige velden/URL/kennisbron | Nederlandse melding bij het veld |
| 400 | `NOT_CONFIGURED` | geen productie-URL in de catalogus | "Er is geen koppeling geconfigureerd. Neem contact op met de beheerder." |
| 401 | `UNAUTHORIZED` | sessie verlopen | "Uw sessie is verlopen. Log opnieuw in." |
| 403 | `FORBIDDEN` | assistent onbekend/uit/verkeerd type/andere org | Nederlandse melding, geen run |
| 409 | `CONFLICT` | `run_id` bestaat al | Nederlandse melding, geen tweede run |
| 413 | `FILE_TOO_LARGE` | bestandslimiet overschreden | inline melding bij Bestanden |
| 422 | `GROUP_VALIDATION` | geen klantsituatie/bestanden/urls | inline melding |
| 502 | `UPSTREAM_*` | n8n weigert/faalt/time-out | bestaande foutstatus + "Opnieuw" |
| 500 | `INTERNAL_ERROR` | onverwachte serverfout | bestaande Nederlandse foutstatus |

## Logging

Alleen `{ code, run_id, ms }`. Nooit bestandsnamen, bestandsinhoud, klantreferentie,
vraagstuk, klantsituatie, URL's, kennisbronnamen, tokens of de callback-signature.
