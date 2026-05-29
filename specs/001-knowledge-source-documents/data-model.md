# Data Model: Kennisbron Documenten

**Feature**: `001-knowledge-source-documents`
**Date**: 2026-05-29

## Geen database-schema wijzigingen

Deze feature voegt **geen nieuwe tabellen of kolommen** toe. Alle benodigde data wordt opgeslagen in bestaande tabellen. De feature past uitsluitend de applicatielogica aan voor:

1. Het genereren van gesigneerde download URLs (runtime, niet opgeslagen)
2. Het uitbreiden van de webhook payload (runtime, niet opgeslagen)

## Bestaande entiteiten (hergebruikt)

### knowledge_bases

| Kolom | Type | Omschrijving |
|-------|------|-------------|
| `id` | UUID (PK) | Uniek identificatie |
| `organization_id` | UUID (FK → organizations) | Tenant ID |
| `name` | text | Naam van de kennisbron |
| `description` | text | Opt. omschrijving |
| `created_by` | UUID (FK → auth.users) | Aanmaker |
| `created_at` | timestamptz | Aanmaakdatum |
| `updated_at` | timestamptz | Laatste wijziging |

### knowledge_base_documents

| Kolom | Type | Omschrijving |
|-------|------|-------------|
| `id` | UUID (PK) | Uniek identificatie |
| `knowledge_base_id` | UUID (FK → knowledge_bases, CASCADE) | Kennisbron |
| `name` | text | Originele bestandsnaam |
| `file_path` | text | Pad in Supabase Storage (`{orgId}/{kbId}/{uuid}.{ext}`) |
| `file_type` | text | Bestandsextensie (pdf, txt, docx) |
| `file_size` | bigint | Grootte in bytes |
| `status` | enum ('processing', 'ready', 'error') | Verwerkingsstatus |
| `created_by` | UUID (FK → auth.users) | Uploader |
| `created_at` | timestamptz | Upload-datum |
| `updated_at` | timestamptz | Laatste statuswijziging |

## Webhook Payload Mapping

| Webhook veld | Bron | Opmerking |
|---|---|---|
| `tenant_id` | `knowledge_bases.organization_id` | Doorgegeven via page props |
| `document_name` | `knowledge_base_documents.name` | Uit het geüploade File object |
| `document_type` | `knowledge_base_documents.file_type` | Lowercase extensie |
| `download_url` | `createSignedUrl(file_path, 900)` | Runtime gegenereerd, niet opgeslagen |

## Storage

- **Bucket**: `knowledge-documents` (bestaand)
- **Padstructuur**: `{organizationId}/{knowledgeBaseId}/{uuid}.{ext}` (ongewijzigd)
- **RLS policies**: Ongewijzigd — de bucket moet `createSignedUrl` operaties toestaan voor geauthenticeerde gebruikers
