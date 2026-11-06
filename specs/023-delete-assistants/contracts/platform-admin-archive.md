# Contract: `platform-admin` — verwijderen en herstellen van assistenten

**Feature**: `023-delete-assistants` | **Versie**: 1 | **Datum**: 2026-11-06

Dit contract bouwt voort op `specs/019-platform-assistant-catalog/contracts/platform-admin.md`.
Transport, CORS, foutcodes, logging en de platformbeheerdercontrole zijn ongewijzigd.
Hieronder staan de nieuwe acties en de gewijzigde regels van bestaande acties.

## Transport en autorisatie (ongewijzigd)

- `POST /functions/v1/platform-admin` met een JSON-body en een `action`.
- `Authorization: Bearer <jwt>` verplicht; ontbreekt of ongeldig → `401 UNAUTHORIZED`.
- `rpc('is_platform_admin')` met de JWT van de aanroeper; geen platformbeheerder →
  `403 FORBIDDEN`.
- Daarna uitsluitend de service-role client.
- Responsevorm bij fouten: `{ "code": "<CODE>", "message": "<NL>" }`.
- Logging: alleen `code`, `action`, `organization_id`, `catalog_id` en duur. Geen
  namen, URL's, tokens of request-bodies.

## Nieuwe actie: `list_archived_assistants`

Request:

```json
{ "action": "list_archived_assistants" }
```

Response `200`:

```json
[
  {
    "catalog_id": "uuid",
    "name": "Schade",
    "icon": "🤖",
    "type": "chat",
    "archived_at": "2026-11-06T09:15:00.000Z"
  }
]
```

- Leest `assistant_catalog` met de service role.
- Alleen rijen met `archived_at IS NOT NULL`.
- Gesorteerd op `archived_at` aflopend (laatst verwijderd bovenaan).
- Geen URL's, beschrijvingen of voorbeeldvragen in het antwoord.

## Nieuwe actie: `archive_catalog_assistant`

Request:

```json
{ "action": "archive_catalog_assistant", "catalog_id": "uuid" }
```

Response `200`: `{ "ok": true }`

- `catalog_id` moet een UUID zijn, anders `400 VALIDATION`.
- Roept `rpc('platform_archive_catalog_assistant', { p_id })` aan.
- `not_found` → `400 VALIDATION` ("Deze assistent bestaat niet meer.").
- `already_archived` → `400 VALIDATION` ("Deze assistent is al verwijderd.").
- Andere databasefout → `500 INTERNAL_ERROR`.
- Laat gesprekken, berichten, analyses, feedback en kennisbronkoppelingen
  ongewijzigd.

## Nieuwe actie: `restore_catalog_assistant`

Request:

```json
{ "action": "restore_catalog_assistant", "catalog_id": "uuid" }
```

Response `200`: `{ "ok": true }`

- `catalog_id` moet een UUID zijn, anders `400 VALIDATION`.
- Roept `rpc('platform_restore_catalog_assistant', { p_id, p_actor: auth.uid() })`
  aan.
- `not_found` → `400 VALIDATION` ("Deze assistent bestaat niet meer.").
- `not_archived` → `400 VALIDATION` ("Deze assistent is niet verwijderd.").
- Andere databasefout → `500 INTERNAL_ERROR`.
- Bestaande organisaties houden hun `is_active`-stand; een organisatie die na het
  verwijderen is aangemaakt krijgt een rij met `is_active = false`.

## Gewijzigde bestaande acties

### `list_org_assistants`

- Voegt `.is('archived_at', null)` toe op `ai_assistants`.
- Een gearchiveerde assistent verschijnt niet meer in de schakelaarrij.

### `set_assistant_active`

- De update geldt alleen voor rijen met `archived_at IS NULL`.
- Een gearchiveerde assistent kan dus niet per ongeluk weer aangezet worden.
- Geen rij geraakt → bestaand `400 VALIDATION` ("Deze assistent hoort niet bij deze
  organisatie.").

### `get_connections`

- De catalogusquery krijgt `.is('archived_at', null)`.
- Gearchiveerde assistenten en hun URL's verschijnen niet in het venster
  Koppelingen. De opgeslagen URL's blijven in de database staan voor herstel.

### `save_connections`

- De bestaanscontrole van elke `catalog_id` krijgt `.is('archived_at', null)`.
- Een gearchiveerde `catalog_id` → `400 VALIDATION` ("Een assistent bestaat niet
  meer.").
- De bestaande URL-validatie en write-only tokenregels blijven ongewijzigd.

### `save_catalog_assistant`

- Bij een niet-null `id` wordt eerst gecontroleerd dat de catalogusrij bestaat én
  `archived_at IS NULL` is.
- Anders → `400 VALIDATION` ("Deze assistent bestaat niet meer.").
- Zo kan een gearchiveerde assistent niet via een directe aanroep weer zichtbaar
  worden gemaakt zonder de herstelactie.

## Databasefuncties

| Functie | Signature | Uitvoerrecht |
|---------|-----------|--------------|
| `platform_archive_catalog_assistant` | `(p_id uuid) returns void` | alleen `service_role` |
| `platform_restore_catalog_assistant` | `(p_id uuid, p_actor uuid) returns void` | alleen `service_role` |
| `platform_seed_org_assistants` | `(p_org uuid, p_actor uuid) returns void` | ongewijzigd, alleen `service_role` |

`PUBLIC`, `anon` en `authenticated` krijgen geen `EXECUTE`.

## Invarianten

1. Geen enkel antwoord bevat ooit `platform_webhook_config.token`.
2. Archiveren en herstellen wijzigen geen gesprekken, berichten, analyses,
   feedback of kennisbronkoppelingen.
3. Archiveren en herstellen wijzigen `ai_assistants.is_active` niet.
4. Een gearchiveerde assistent is nooit bruikbaar via `rag-chat` of
   `analysis-run-submit`, ook niet met een openstaand gesprek of een directe
   aanroep.
5. Elke nieuwe actie schrijft alleen na een geslaagde platformbeheerdercontrole.
6. De functie leest of logt geen cliëntinhoud.
