# Beslissing: Documentstatus-overgangen voor herverwerken op de serverroute

**Datum**: 2026-10-30 | **Feature**: 016-knowledge-source-manageability

## Decision

"Opnieuw verwerken" zet de status niet in de browser. De client roept alleen
`document-webhook` aan met `action: 'index'`; de Edge Function zet met de
service role `status = 'processing'` en `error_message = null` vóór de
n8n-call, en zet bij falen `status = 'error'` met een Nederlandse reden.

## Context

De technische route vroeg een client-side update van `status` en
`error_message`. `knowledge_base_documents` heeft sinds migratie 015 echter
geen UPDATE-policy (default deny); statusovergangen zijn expliciet aan de
service role voorbehouden. Elke client-update zou dus falen, ook voor een
admin. Dezelfde feature voegt de nullable kolom `error_message` en de view
`knowledge_base_stats` toe.

## Alternatives considered

- **Admin-only UPDATE-policy op `knowledge_base_documents`** — afgewezen:
  admins krijgen dan via REST ook schrijfrecht op `name`, `file_path` en
  andere kolommen; te breed voor alleen een statusovergang.
- **SECURITY DEFINER-RPC `retry_document_index`** — afgewezen: extra
  DB-object en een tweede schrijfpad; bij een mislukte webhook-call daarna
  blijft het document op `processing` staan.
- **Status in de client zetten** — onmogelijk onder de bestaande RLS.

## Reasoning

De serverroute is al de enige weg naar de ingestflow (feature 009), heeft de
service role al en kan de status in dezelfde operatie consistent houden. Eén
client-aanroep, geen verzwakking van RLS, en geen permanente
`processing`-reststand: elke faalroute zet terug naar `error` met reden.

## Trade-offs accepted

- De Edge Function krijgt statuslogica en schrijft nu ook `error_message` bij
  een directe upstream-fout; n8n vult de kolom later voor asynchrone fouten.
- De 009-contractregel "bij uploadfout blijft de status processing" vervalt
  voor `action: 'index'`; vastgelegd in
  `specs/016-knowledge-source-manageability/contracts/document-retry.md`.
- De functie moet gedeployed zijn vóór de retry-knop live gaat.

## Supersedes

Geen eerdere beslissing; vult `specs/009-secure-n8n-proxy/contracts/document-webhook.md`
aan voor `action: 'index'`.
