# Quickstart: Teambeheer: uitnodigen, rol wijzigen en blokkeren

**Feature**: `020-team-management` | **Branch**: `020-team-management`

> **Er is nog niets van 020 toegepast of gedeployed.** Elke migratie en elke
> Edge Function deploy vraagt om uw expliciete bevestiging in de chat. De 019
> backend is al live; de 019 frontend is naar `main` gemerged (PR #35 -> #36),
> maar de Netlify-productiedeploy moet nog worden gecontroleerd.

## 0. Voorwaarden

| Voorwaarde | Controle |
|---|---|
| 019 live | Migratie 021 toegepast; `platform-admin`, `rag-chat`, `document-webhook`, `create-tenant` gedeployed |
| 019 frontend live | Netlify-productiedeploy van `main` controleren; `/settings` toont de 019-tabs |
| Platformbeheerder | `jaap@jaaphoeve.com` staat in `public.platform_admins` en heeft een profiel |
| SMTP | Scaleway TEM ingesteld in Supabase Auth (host, poort, gebruiker, wachtwoord, afzender) |
| Site URL | Productie-URL van de app ingesteld in Supabase Auth |
| Invite-template | Link naar `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite` |
| Link geldigheid | Supabase Auth `Email OTP Expiration` = `86400` seconden (24 uur) |
| Redirect URLs | `/auth/confirm` en `/reset-password` toegestaan |
| Bevestiging | Migratie 022 en elke functiedeploy zijn in de chat bevestigd |

De e-mailtemplate is Nederlands in de u-vorm en noemt de organisatie, de rol en
de geldigheidsduur. Zet geen tokens of e-mailadressen in de template-onderwerpregel.

Optionele lokale E2E-variabelen (`.env.local`, nooit echte waarden in de repo):

```dotenv
E2E_EMAIL=...
E2E_PASSWORD=...
E2E_MEMBER_EMAIL=...
E2E_MEMBER_PASSWORD=...
E2E_PLATFORM_ADMIN_EMAIL=...
E2E_PLATFORM_ADMIN_PASSWORD=...
E2E_TEST_ORG_NAME=...
E2E_BLOCK_TARGET_EMAIL=...
E2E_BLOCK_TARGET_PASSWORD=...
E2E_INVITE_EMAIL_BASE=invite+e2e@example.com
```

`E2E_INVITE_EMAIL_BASE` is een plus-adres; de test maakt daar
`naam+e2e-<timestamp>@domein.nl` van. De block-target is een adviseur in
`E2E_TEST_ORG_NAME` en wordt na de test altijd gedeblokkeerd.

## 1. Migratie 022

Bestand: `supabase/migrations/022_team_management.sql`.

Inhoud: zie [data-model.md](./data-model.md) en
[contracts/team-db.md](./contracts/team-db.md):

1. `profiles.email` (backfill uit `auth.users`, `NOT NULL`, unieke index op
   `lower(email)`).
2. `profiles.status` (`invited`/`active`/`blocked`, default `active`).
3. `BEFORE INSERT`-trigger die `email` uit `auth.users` vult.
4. Block-aware `get_user_org_id()`, `is_org_admin()`, `is_platform_admin()`.
5. De 30 policy drop/recreates met `AND get_user_org_id() IS NOT NULL`.
6. `activate_own_profile()` (authenticated execute).
7. `team_update_member()` (alleen service_role execute).

**Toepassen** (alleen na bevestiging): Supabase MCP `apply_migration` met naam
`team_management` en de definitieve SQL. Niet met de hand in de SQL-editor, zodat
de migratiehistorie klopt.

### Preflight vóór de migratie

```sql
-- geen profiel zonder auth-user, geen auth-user zonder profiel
select
  (select count(*) from public.profiles p
     where not exists (select 1 from auth.users u where u.id = p.id)) as profiles_without_auth,
  (select count(*) from auth.users u
     where not exists (select 1 from public.profiles p where p.id = u.id)) as auth_without_profile;

-- elke organisatie heeft een admin
select o.name from public.organizations o
where not exists (
  select 1 from public.profiles p
  where p.organization_id = o.id and p.role = 'admin'
);

-- geen dubbele e-mailadressen (auth.users is leidend)
select lower(u.email), count(*)
from auth.users u
join public.profiles p on p.id = u.id
group by lower(u.email)
having count(*) > 1;
```

Verwacht: beide tellingen 0, de tweede query 0 rijen en de derde query 0
dubbele adressen. Stop en meld bij een afwijking.

## 2. Verificatie direct na de migratie

```sql
-- a. kolommen
select column_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles'
  and column_name in ('email', 'status');

-- b. geen client-update op email/status
select grantee, privilege_type, column_name
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'profiles'
  and privilege_type = 'update'
order by grantee, column_name;
-- verwacht: authenticated => avatar_url, full_name; anon => niets

-- c. bestaande gebruikers actief en gemaild
select status, count(*) from public.profiles group by status;  -- verwacht: active
select count(*) from public.profiles where email is null;       -- verwacht: 0

-- d. functies en rechten
select routine_name, grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name in ('activate_own_profile', 'team_update_member')
order by routine_name, grantee;

-- e. de 30 policies bevatten de null-check
select tablename, policyname, qual, with_check
from pg_policies
where schemaname in ('public', 'storage')
  and (qual like '%get_user_org_id() IS NOT NULL%'
       or with_check like '%get_user_org_id() IS NOT NULL%')
order by schemaname, tablename, policyname;
-- verwacht: 30 rijen
```

De volledige policy-checklist staat in
[contracts/team-db.md](./contracts/team-db.md) §6.

## 3. Edge Functions deployen (na bevestiging, in deze volgorde)

1. `team-admin` (nieuw)
2. `rag-chat` (opnieuw gedeployed; code ongewijzigd; leest het profiel via de
   user-client, RLS sluit geblokkeerden)
3. `send-feature-request` (gewijzigd; expliciete blocked-check)
4. `create-tenant` (gewijzigd; `email` + `status: 'active'`)

Rooktest na elke deploy:

| Functie | Controle |
|---|---|
| `team-admin` | geen Authorization → 401; adviseur → 403; kantoorbeheerder andere org → 403; `list_members` eigen org → 200 |
| `rag-chat` | actief lid → normaal antwoord; geblokkeerd lid → 403 |
| `send-feature-request` | geblokkeerd lid → 403 "Uw account is geblokkeerd." |
| `create-tenant` | kantoorbeheerder → 403; platformbeheerder → nieuwe organisatie met alle assistenten aan |

`ALLOWED_ORIGINS` moet de Netlify-origin(s) bevatten; zonder match krijgt de
browser geen CORS-header (fail-closed).

## 4. Frontend releasen

Na de functies: de `src/`-wijzigingen uit [plan.md](./plan.md) deployen.

Controle:

- Kantoorbeheerder: Team in het menu; tabel met Naam, E-mailadres, Rol, Status,
  Toegevoegd en acties; "Nodig uit" opent het dialoog.
- Adviseur: geen Team in het menu; `/team` toont "Geen toegang".
- Platformbeheerder: Instellingen → Team → organisatie kiezen; dezelfde lijst en
  acties; de keuze overleeft een herlaadbeurt via `?org=`.
- Uitgenodigd: "Uitnodiging opnieuw versturen" en "Uitnodiging intrekken".
- Actief: "Blokkeren"; Geblokkeerd: "Deblokkeren".
- Eigen rij en beschermde platformbeheerder: geen acties; de rolselect is
  uitgeschakeld.
- Laatste actieve beheerder: rolselect uitgeschakeld; directe aanroep geeft 409.
- Alle icoonknoppen hebben een Nederlandse `aria-label`; de tabel is met Tab te
  bedienen; de status is tekst, niet alleen kleur.
- `/auth/confirm?token_hash=...&type=invite` opent de activering, verwijdert de
  query en leidt naar `/reset-password`; een ongeldige link toont de
  voorgeschreven melding.

## 5. `invite-user` verwijderen (handmatig, na de frontendrelease)

De nieuwe frontend gebruikt `team-admin`; `invite-user` is niet meer nodig.

1. Verwijder in het Supabase-dashboard de Edge Function `invite-user`.
2. Het bestand `supabase/functions/invite-user/` is in de feature al verwijderd.
3. Werk `README.md` bij: `invite-user` → `team-admin`.

Verwijder `flow-config` alleen als de 019-frontend aantoonbaar live staat; dat is
een 019-reststap, geen 020-stap.

## 6. Tests

```bash
npx tsc --noEmit
npx eslint src/ --max-warnings 0
npm run build
npx playwright test tests/e2e/team-management.spec.ts
npx playwright test                      # volledige regressie
node scripts/rls-verify.mjs              # member + kantoorbeheerder + blocked target
```

De Playwright-tests slaan met een duidelijke reden over als
`E2E_EMAIL/PASSWORD`, `E2E_MEMBER_*`, `E2E_PLATFORM_ADMIN_*`,
`E2E_BLOCK_TARGET_*`, `E2E_TEST_ORG_NAME` of `E2E_INVITE_EMAIL_BASE` ontbreken.

`rls-verify.mjs` controleert:

- adviseur en kantoorbeheerder kunnen `profiles.email`, `profiles.status`,
  `profiles.role` en `profiles.organization_id` niet updaten;
- een geblokkeerde gebruiker leest niets uit `profiles`, `conversations`,
  `messages`, `ai_assistants`, `knowledge_bases` en de storage-bucket;
- `anon` kan `activate_own_profile` en `team_update_member` niet uitvoeren;
- `authenticated` kan `team_update_member` niet uitvoeren;
- de bestaande positieve checks blijven groen.

## 7. Rollback

- **Migratie**: nieuwe migratie die de drie helpers zonder blocked-check
  herstelt, de 30 oorspronkelijke policy-expressies terugzet en
  `team_update_member`, `activate_own_profile`, de insert-trigger en
  `set_profile_email` dropt. De kolommen `email`/`status` mogen blijven
  (`status` default `active`); na een frontend-rollback kunnen ze alsnog worden
  gedropt.
- **Edge Functions**: vorige versie terugzetten via het Supabase-dashboard.
- **Frontend**: vorige Netlify-deploy restoren.
- **Data**: bestaande gebruikers blijven `active`; geblokkeerde gebruikers kunnen
  na de rollback weer inloggen als de helper-check is verwijderd. Draai de
  rollback alleen na expliciete bevestiging.

## 8. Definition of Done

- [ ] Preflight §1 is schoon
- [ ] Migratie 022 toegepast en §2 gecontroleerd
- [ ] `team-admin`, `rag-chat`, `send-feature-request`, `create-tenant` gedeployed
- [ ] `npx tsc --noEmit` groen
- [ ] `npx eslint src/ --max-warnings 0` groen
- [ ] `npm run build` groen
- [ ] `tests/e2e/team-management.spec.ts` groen (of met duidelijke skip)
- [ ] volledige Playwright-regressie groen
- [ ] `node scripts/rls-verify.mjs` groen
- [ ] `/auth/confirm` handmatig getest met een echte uitnodigingsmail
- [ ] PostHog-event van `/auth/confirm?token_hash=...` bevat geen query/fragment
- [ ] geblokkeerde open sessie toont de Nederlandse melding en is uitgelogd
- [ ] `README.md` bijgewerkt; `FEATURES.md` via `@feature-tracker`
- [ ] `invite-user` na de frontendrelease verwijderd
- [ ] `flow-config` alleen verwijderd als 019 live is (019-reststap)

## 9. Bewuste gedragswijzigingen

| Wijziging | Toelichting |
|---|---|
| Inloggen van een geblokkeerde gebruiker | Blijft de algemene melding: GoTrue controleert de ban vóór het wachtwoord, dus `user_banned` zou account-enumeratie mogelijk maken. De blokkademelding verschijnt bij een open sessie die zijn profiel verliest. |
| Uitnodigen | Gaat nu via een echte e-mail en `/auth/confirm`; de oude `invite-user`-flow (wachtwoord vergeten) verdwijnt. |
| Teamlijst | Uitgenodigde en geblokkeerde teamleden staan in dezelfde tabel; de oude kaart "Openstaande uitnodigingen" verdwijnt. |
| Profiel | `profiles.email` en `profiles.status` zijn nieuw; bestaande gebruikers worden `active`. |
| Blokkeren | Een ban alleen is niet genoeg; RLS en de Edge Functions weigeren vanaf het eerstvolgende verzoek. |
| Storage | De vier orphaned bucket-only policies krijgen alleen de blocked-null-check; bredere cross-tenant-hardening is buiten scope. |
