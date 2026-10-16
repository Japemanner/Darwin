# Beslissing: n8n-koppeling server-side beveiligd — token, CORS en rollout-volgorde

**Datum**: 2026-10-14 | **Feature**: 009-secure-n8n-proxy

## Decision

1. Het n8n-webhook-token wordt als **platte tekst server-side** opgeslagen in
   `flow_configs.webhook_token`, beveiligd met `REVOKE SELECT` (tabelniveau) +
   kolom-grants (zonder token-kolom) voor `anon`/`authenticated`; client-side
   encryptie is volledig vervallen (`VITE_ENCRYPTION_KEY` verwijderd uit code,
   .env.example, vite-env.d.ts en Netlify).
2. CORS op de drie nieuwe Edge Functions is **fail-closed** via de secret
   `ALLOWED_ORIGINS` (exacte origin-match, nooit een wildcard). Onbekende of
   ontbrekende Origin → géén `Access-Control-Allow-Origin`-header.
3. De release naar `main` vond in één stap plaats (develop-preview-test
   overgeslagen) op expliciete instructie van de eigenaar; de wipe-migratie
   (014) liep vóór de per-organisatie token-invoer.
4. Edge Functions lezen `VITE_`-geprefixteerde secretnamen (zoals in het
   secret-panel gezet) **met fallback** op de Supabase platform-defaults
   (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).

## Context

De browser riep de n8n-webhooks rechtstreeks aan; de AES-sleutel zat in de
publieke bundel (elke ingelogde gebruiker kon het token ontcijferen) en de
browser bepaalde tenantId/kennisbronnen/system prompt (cross-tenant
bevraging mogelijk). Feature 009 verhuisde alle n8n-communicatie naar drie
Edge Functions (rag-chat, document-webhook, flow-config).

## Alternatives considered

- **Token her-versleutelen met een uitsluitend server-bekende sleutel**
  (aanname uit de oorspronkelijke spec): verworpen — extra key-management,
  migratiescript en rotatiecomplexiteit, terwijl kolom-grants + RLS + gateway
  hetzelfde dreigingsmodel (browser-uitlees) afsluiten zonder sleutels.
- **Wildcard-CORS** zoals de bestaande huisfuncties (invite-user e.d.):
  verworpen — de nieuwe functies verwerken berichtinhoud en tokens.
- **Migratie vóór de frontend-release**: verworpen — breekt de live oude
  bundel (die `flow_configs` met `select *` leest).

## Reasoning

De database zit achter Supabase-auth; het werkelijke lek was de browser. Grats
+ REVOKE schermen het token af voor elke client-rol, de service-role (enige
lezer) werkt uitsluitend server-side. De UI bewaart write-only semantiek via
`has_token`. Dit is het eenvoudigste ontwerp dat alle acceptatiecriteria haalt.

## Trade-offs accepted

- Geen versleuteling-at-rest van het token: bij een Postgres-compromis is het
  leesbaar; geaccepteerd omdat het token jederzeit via de UI roteerbaar is.
- Cutover-venster waarin chat NL-foutmeldingen toont (functions live → frontend
  live → migratie → token-invoer); bewust gedocumenteerd in quickstart.md.
- main-release zonder afzonderlijke develop-preview-test (eigenaar-instructie);
  ondervangen met live productieverificatie (curl 401/403/200, CORS-headercheck,
  REST-grantchecks, happy paths).

## Supersedes

- `specs/002-rag-assistant-management/plan.md` (client-side AES-256-GCM
  "acceptabel voor v1") en de client-side encryptie uit feature 002
  (`src/lib/webhook.ts`, verwijderd in `55a02df`).