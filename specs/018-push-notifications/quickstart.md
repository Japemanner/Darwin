# Quickstart: Pushmeldingen (feature 018)

**Feature**: 018-push-notifications | **Datum**: 2026-10-31

## 0. Vooraf: bestaat de analysecallback?

Deze repository bevat geen `analysis_runs`-migratie en geen
`analysis-run-callback`. Controleer via Supabase MCP of de functie in het
project draait:

```text
MCP: list_edge_functions  (of: supabase functions list)
```

- **Bestaat hij** → noteer de projectref en pas
  `contracts/analysis-callback-integration.md` toe.
- **Bestaat hij niet** → ga verder met §1–§6. De meldingen zijn dan volledig
  getest via de send-functie, maar US2 is pas end-to-end actief zodra het
  analyse-backend de hook toevoegt. Dit wordt expliciet in FEATURES.md vermeld.

Noteer de uitkomst hier:

```text
Datum:            2026-10-31
Callback aanwezig: NEE — `list_edge_functions` geeft alleen invite-user,
                  create-tenant, send-feature-request, rag-chat,
                  document-webhook en flow-config; er is ook geen
                  `analysis%`-tabel in schema public. Het analyse-backend
                  staat buiten dit project.
Projectref:       ddfjigrjwlfpaljhhogv
Gevolg:           US2 is opgeleverd tot en met de send-functie en de service
                  worker. De callback-hook (contract
                  `contracts/analysis-callback-integration.md`) is een
                  gedocumenteerde afhankelijkheid: zodra het analyse-backend
                  `analysis-run-callback` uitrolt, roept het `push-send` aan na
                  een echte statusovergang.
```

De rest van dit document is de uitrolinstructie. De status van elke stap staat
in `tasks.md`; wat nog moet gebeuren is in de kolom "Gap" van FEATURES.md
samengevat.

## 1. Vereisten

- Node 24 (voor scripts en `node --test`)
- Supabase CLI (geïnstalleerd; `supabase --version` → 2.102+)
- Toegang tot Supabase MCP (migratie + deploy) of een Management API-token
- Een Chromium-browser voor de handmatige rooktest (Playwright test geen echte push)
- `E2E_MEMBER_EMAIL` / `E2E_MEMBER_PASSWORD` in `.env.local` (of de shell) voor de
  geauthenticeerde Playwright-tests; zonder die variabelen skipt de suite met een
  duidelijke reden. Sinds 2026-10-31 bestaat er een apart lidaccount
  (role=member) waarvan de credentials alleen in `.env.local` staan.

## Uitgevoerd op 2026-10-31 (status)

| Stap | Uitkomst |
|---|---|
| §2 migratie | toegepast via Supabase MCP `apply_migration`; remote versie `20261031154614` (naam `push_subscriptions`) — wijkt af van de lokale bestandsnaam `019_push_subscriptions.sql`, dus bij een latere `supabase db push` eerst `migration repair` |
| §2 RLS | `rowsecurity = true`, precies drie policies (SELECT/INSERT/DELETE, alle `auth.uid() = user_id`), geen UPDATE-policy |
| §3 secrets | `VAPID_KEYS`, `VAPID_SUBJECT` (`mailto:jaap@jaaphoeve.com`) en `PUSH_SEND_TOKEN` gezet via de Management API (`POST /v1/projects/{ref}/secrets`); de Supabase CLI 2.102 weigert het huidige tokenformaat (`sbp_v0_…`), de Management API accepteert het |
| §3 frontend | `VITE_VAPID_PUBLIC_KEY` staat in `.env.local`; **open**: dezelfde variabele in Netlify (CLI niet ingelogd) |
| §4 deploy | `push-send` versie 1, status ACTIVE, `verify_jwt: false` |
| §4 R1-smoke | met één synthetische rij (geldige ECDH-sleutels, onbereikbaar endpoint): `401` bij fout token, `400 VALIDATION` bij ongeldige body, `200 {"ok":true,"sent":0,"removed":0,"failed":1}` — `jsr:@negrel/webpush` initialiseert en codeert dus op de Edge Runtime; logs tonen `PUSH_SENT` + `SEND_FAILED` zonder endpoint, sleutels of klantgegevens; geen fallback nodig |
| §4 RLS-rooktest | met het lidaccount: eigen insert PASS, select alleen eigen rijen, delete van andermans rij 0 rijen, insert voor een ander `42501`, update 0 rijen (geen UPDATE-policy) |
| §5 echte push | **open** — vereist een browser met toestemming en een echte analyse-run |
| §6 tests | `node --test` 15/15 groen; de push-spec is 5/5 groen met het lidaccount (echte `push_subscriptions`-ronde, opgeruimd na elke test); volledige suite 18 passed / 68 skipped / 0 failed — de 68 skips zijn de admin-tests zonder `E2E_EMAIL`/`E2E_PASSWORD` |

## 2. Migratie toepassen

`supabase/migrations/019_push_subscriptions.sql` aanmaken en **via Supabase MCP**
toepassen (dit project is productie; geen `db push` tegen productie).

Daarna verifiëren:

```sql
-- RLS aan?
select tablename, rowsecurity from pg_tables where tablename = 'push_subscriptions';

-- Policies?
select policyname, cmd, qual, with_check
from pg_policies
where tablename = 'push_subscriptions';
```

Verwacht: `rowsecurity = true` en drie policies (`SELECT`, `INSERT`, `DELETE`),
alle met `auth.uid() = user_id`. Geen `UPDATE`-policy.

## 3. VAPID-sleutels genereren en secrets zetten

```bash
node scripts/generate-vapid-keys.mjs
```

Het script print drie blokken:

```text
VAPID_KEYS={"publicKey":{...},"privateKey":{...}}
VAPID_PUBLIC_KEY=<base64url>
VAPID_SUBJECT=mailto:beheer@example.nl
```

Zet de secrets (nooit in de repo, nooit in `.env.local` voor de private key):

```bash
supabase secrets set VAPID_KEYS='{"publicKey":{...},"privateKey":{...}}'
supabase secrets set VAPID_SUBJECT='mailto:beheer@example.nl'
supabase secrets set PUSH_SEND_TOKEN='<genereer met: openssl rand -hex 32>'
```

Frontend (publieke sleutel, mag in de bundel):

```bash
# .env.local
VITE_VAPID_PUBLIC_KEY=<base64url>
```

Zet dezelfde variabele in Netlify → Site settings → Environment variables.
Werk `.env.example` bij met een placeholder.

## 4. `push-send` deployen

```bash
supabase functions deploy push-send --no-verify-jwt
```

Waarom `--no-verify-jwt`: de functie wordt alleen server-to-server aangeroepen
en beschermt zichzelf met `X-Push-Token`. Een browser-JWT is hier geen
toegangsbewijs.

Controleer in de logs dat de functie start zonder `crypto`-fout (research R1).

### RLS rooktest (twee accounts)

```text
Als gebruiker A: insert een rij met user_id = A  → moet slagen
Als gebruiker A: select alle rijen               → alleen eigen rijen
Als gebruiker A: delete een rij van B            → 0 rijen, geen fout
Als gebruiker A: insert met user_id = B          → moet falen (42501)
```

## 5. End-to-end rooktest (echte push)

1. Open de app in Chrome of Edge op desktop, log in als adviseur (member).
2. Klik in het gebruikersblok op **Meldingen aanzetten** → toestemming verlenen.
3. Controleer de status: "Meldingen staan aan op dit apparaat".
4. Start een risico-analyse en sluit het tabblad (of minimaliseer de browser).
5. Na afronding verschijnt de systeemmelding:
   - geslaagd → **Uw risico-analyse is gereed**
   - mislukt → **Uw risico-analyse is mislukt**
6. Klik op de melding → `/analyse/<run-id>` opent (of de app opent op dat adres).
7. Klik op **Meldingen uitzetten** → status "uit"; start nog een analyse →
   geen melding meer.
8. Log uit en weer in → status staat op "uit".
9. Test op een tweede apparaat: aanzetten → beide apparaten ontvangen de
   melding.

### Zonder callback (als §0 "nee" opleverde)

Roep `push-send` handmatig aan met een bestaand `user_id` en een geldige
`/analyse/<uuid>`:

```bash
curl -X POST "$SUPABASE_URL/functions/v1/push-send" \
  -H "Content-Type: application/json" \
  -H "X-Push-Token: $PUSH_SEND_TOKEN" \
  -d '{"user_id":"<uuid>","kind":"analysis_succeeded","url":"/analyse/<uuid>"}'
```

Verwacht: `{"ok":true,"sent":1,"removed":0,"failed":0}` en een
systeemmelding. Herhaal met een ongeldige URL → `400 VALIDATION`.

## 6. Tests

```bash
# Send-logica (geen netwerk, geen Supabase)
node --test supabase/functions/push-send/logic.test.ts

# Playwright: aanzetten, uitzetten, geweigerd, niet ondersteund
npx playwright test tests/e2e/push-notifications.spec.ts

# Volledige regressie
npx playwright test

# Typecheck + fitness
npx tsc --noEmit
bash scripts/fitness-check.sh
```

De Playwright-tests gebruiken `test.use({ permissions: ['notifications'] })` en
stubben `PushManager` (echte pushbezorging is niet deterministisch testbaar).
Zie `research.md` R8.

## 7. Opruimen / terugdraaien

```sql
-- Abonnementen verwijderen (alleen bij een rollback)
delete from push_subscriptions;
-- Tabel verwijderen
drop table if exists push_subscriptions;
```

Secrets verwijderen: `supabase secrets unset VAPID_KEYS VAPID_SUBJECT PUSH_SEND_TOKEN`.
De service worker (`public/sw.js`) blijft onschadelijk zonder abonnementen; bij
een volledige rollback ook de registratie uit AppShell verwijderen en het
bestand deleten.

## Checklist

- [x] §0 uitgevoerd en vastgelegd (callback aanwezig ja/nee → **nee**)
- [x] Migratie toegepast, RLS + policies geverifieerd
- [ ] VAPID-secrets gezet, `VITE_VAPID_PUBLIC_KEY` in `.env.local` **en Netlify** (Netlify nog open)
- [x] `push-send` gedeployed, geen crypto-fout in de logs
- [x] RLS-rooktest met twee accounts geslaagd (member + admin; eigen rijen alleen, insert voor een ander `42501`, geen UPDATE-policy)
- [ ] Handmatige push-rooktest geslaagd (aan, uit, klik, uitloggen)
- [x] `node --test` groen (15/15)
- [x] Playwright push-spec groen (5/5); volledige regressie 18 passed / 68 skipped / 0 failed (admin-tests skippen zonder `E2E_EMAIL`/`E2E_PASSWORD`)
- [x] `tsc --noEmit` en fitness-check groen (fitness: 0 fail, 1 warn, 4 skip)
- [x] FEATURES.md bijgewerkt (inclusief callback-afhankelijkheid)
