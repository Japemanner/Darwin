# Quickstart & Rollout: 009-secure-n8n-proxy

**Date**: 2026-10-13 | **Feature**: [spec.md](spec.md)

Handmatige stappen voor Jaap. Dit Supabase-project is **productie**; de
volgorde hieronder is verplicht.

## 1. Voorbereiding (vóór de release)

- Genereer een nieuw n8n-webhook-token en zet het in de n8n-credential
  **"Darwin auth"** (verbeterplan N5). Oude tokens zijn gelekt en vervallen.
- Bepaal de waarde van `ALLOWED_ORIGINS` (komma-gescheiden, bijv.
  `https://darwin.app` en eventueel `http://localhost:5173` voor
  ontwikkeling — géén `*`).

## 2. Lokale ontwikkeling en geautomatiseerde checks

```bash
npx tsc --noEmit
npx eslint src/ --max-warnings 0
npm run build
bash scripts/fitness-check.sh        # incl. nieuwe F-18
npx playwright test                 # e2e met page.route-mocks op de edge functions
```

Bundle-controle (SC-001) — grep op de **waarde** van de oude sleutel (Vite
vervangt de naam `VITE_ENCRYPTION_KEY` in de bundel door de letterlijke
waarde; op de naam grepen geeft dus vals negatief). Voor `crypto.subtle`:
alleen `decrypt`/`encrypt` zijn verdacht — `digest`/`importKey`/`verify`
komen legaal uit de Supabase-auth-library (PKCE/JWKS):

```bash
OLD_KEY=$(grep VITE_ENCRYPTION_KEY .env.local | cut -d= -f2)
grep -rF "$OLD_KEY" dist/                              # geen treffers
grep -rE "crypto\.subtle\.(decrypt|encrypt)" dist/     # geen treffers
```

## 3. Releasevolgorde (verplicht — anders breekt de live chat)

| Stap | Actie | Waarom |
|------|-------|--------|
| 1 | Deploy de Edge Functions `rag-chat`, `document-webhook` en `flow-config` via de Supabase MCP | De oude frontend gebruikt ze nog niet; ongevaarlijk |
| 2 | Zet de enige handmatige secret: `ALLOWED_ORIGINS` (Supabase dashboard → Edge Functions → Secrets, of `supabase secrets set ALLOWED_ORIGINS=...`). `SUPABASE_URL`, `SUPABASE_ANON_KEY` en `SUPABASE_SERVICE_ROLE_KEY` zijn platform-defaults die Supabase automatisch injecteert — de functies lezen exact die namen. Waarde: komma-gescheiden origins, bijv. `https://<productiedomein>,http://localhost:5173` (localhost erbij als je lokaal tegen de gedeployde functies test) | Fail-closed: zonder deze secret blokkeert de browser alle aanroepen |
| 3 | Merge de feature-PR naar `develop`, test op de Netlify preview-deploy, en merge naar `main` | De nieuwe frontend leest geen `webhook_token` meer |
| 4 | Pas migratie `014_flow_configs_token_lockdown.sql` toe via de Supabase MCP (wist de gelekte tokens, trekt de leesrechten in en sluit de UPDATE-policy met `WITH CHECK`) | Pas ná de nieuwe frontend, want de oude bundle leest `flow_configs` met `*`. **Waarschuwing: tokens die tussen stap 3 en 4 via de nieuwe UI worden opgeslagen, worden door de wipe gewist — token-invoer pas ná deze stap** |
| 5 | Per organisatie: voer het nieuwe token in via **Instellingen → Webhooks** en druk op "Verbinding testen" | Chat en documentverwerking zijn pas ná de token-invoer weer bruikbaar |
| 6 | Verwijder `VITE_ENCRYPTION_KEY` uit de Netlify environment en deploy opnieuw | Voorkomt dat de sleutel ooit weer in de bundel belandt |
| 7 | Controleer de productie-bundel: grep op de **oude sleutelwaarde** en op `crypto.subtle.decrypt\|crypto.subtle.encrypt` in `dist/` → leeg (zie stap 2) | SC-001 |

**Cutover-venster**: vanaf **stap 3** (nieuwe frontend live; de oude tokens
zijn onleesbare hex-ciphertext voor de Edge Functions) tot en met **stap 5**
toont de chat de Nederlandse foutmelding (UPSTREAM_AUTH / NOT_CONFIGURED)
totdat het token is ingevoerd. Dit is bewust: de oude tokens zijn gelekt en
worden vervangen (spec-aanname). Twee randgevallen: (a) tokens die vóór stap
4 worden opgeslagen worden door de wipe-migratie gewist; (b) browsertabs met
de oude bundel kunnen na stap 4 fouten geven — een herladen lost dat op
(aankondigen aan de gebruikers is netjes maar optioneel).

## 4. Verificatie met curl (na stap 1-2, vóór stap 3 mag ook)

```bash
# 401 zonder JWT
curl -i -X POST "https://<project>.supabase.co/functions/v1/rag-chat" \
  -H "Content-Type: application/json" \
  -d '{"assistant_id":"…","conversation_id":"…","message":"test"}'

# 200/403 met een geldig JWT (uit een actieve browser-sessie of
# supabase-js); gebruik voor de 403-test een assistant_id van een
# andere organisatie
curl -i -X POST "https://<project>.supabase.co/functions/v1/rag-chat" \
  -H "Authorization: Bearer <jwt>" -H "Content-Type: application/json" \
  -d '{"assistant_id":"<eigen org>","conversation_id":"<eigen org>","message":"test"}'
```

Verwacht: `401` met code `UNAUTHORIZED` zonder JWT; `403` met `FORBIDDEN`
bij een assistent/gesprek van een andere organisatie; `200` met
`{ answer, sources, … }` bij een normale aanroep.

## 5. Verificatie token-afscherming (na stap 4)

Via de Supabase REST API met de anon key of een gewone ingelogde sessie:

```bash
curl -i "https://<project>.supabase.co/rest/v1/flow_configs?select=*" \
  -H "apikey: <anon-key>"
```

Verwacht: fout of leeg resultaat (`select=*` omvat `webhook_token`). Met
`select=id,flow_type,webhook_url,webhook_auth_header` werkt het lezen wél
(SC-004). Hertest daarna de chat en de Instellingen in de UI.

## 6. Payload-controle kennisbronnen (SC-005)

Stel een chat-assistent met twee kennisbronnen en stel één vraag. Controleer
in n8n (execution data van de webhook-node) dat de body zowel
`knowledge_sources: ["bron-a", "bron-b"]` (lijst) als het legacy-veld
`knowledgeSourceName` bevat. De zoekstap vindt pas resultaten uit beide
bronnen ná omschakeling N1 (n8n-kant) op de lijst.

## 7. Netwerkcontrole in de browser (SC-002)

Open de DevTools → Network tijdens: een chatvraag stellen, een document
uploaden/verwijderen en een verbindingstest in Instellingen. Er mag géén
request naar het n8n-domein verschijnen; alleen aanroepen naar
`<project>.supabase.co` (functions + rest + storage).