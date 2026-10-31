# Phase 1 Data Model: Platformbeheer van assistentcatalogus, organisatieschakelaars en n8n-koppelingen

**Feature**: `019-platform-assistant-catalog` | **Date**: 2026-10-31

## 1. Overzicht

```text
auth.users ─┬─ platform_admins (user_id)          → platformbeheerder
            └─ profiles (id, organization_id, role)

organizations ─┬─ ai_assistants (organization_id, catalog_id, is_active, ...)
               │        └─ assistant_catalog (id, naam, type, test-URL, prod-URL)
               │        ├─ conversations.assistant_id          (ongewijzigd)
               │        └─ assistant_knowledge_bases.assistant_id (ongewijzigd)
               ├─ knowledge_bases
               └─ flow_configs (blijft bestaan, niet meer gebruikt)

platform_webhook_config (exact één rij: headernaam, token, document-URL)
```

De catalogus is de bron van waarheid; de `ai_assistants`-rij is de per-organisatie
verschijning en het knooppunt voor gesprekken en kenniskoppelingen.

## 2. Nieuwe tabellen

### 2.1 `public.platform_admins`

| Kolom | Type | Regels |
|---|---|---|
| `user_id` | uuid | PK, FK → `auth.users(id)` ON DELETE CASCADE |
| `created_at` | timestamptz | NOT NULL DEFAULT now() |

RLS aan, **geen policies**, `REVOKE ALL ON public.platform_admins FROM anon, authenticated;`

### 2.2 `public.assistant_catalog`

| Kolom | Type | Regels |
|---|---|---|
| `id` | uuid | PK DEFAULT `gen_random_uuid()` |
| `name` | text | NOT NULL |
| `description` | text | nullable |
| `icon` | text | NOT NULL DEFAULT `'🤖'` |
| `type` | text | NOT NULL, CHECK `type IN ('chat','agent','voice','risico_analyse')` |
| `example_questions` | text[] | NOT NULL DEFAULT `'{}'` |
| `test_webhook_url` | text | nullable; alleen opslaan, niet gebruiken |
| `prod_webhook_url` | text | nullable; gebruikt door `rag-chat` voor type chat |
| `created_at` | timestamptz | NOT NULL DEFAULT now() |
| `updated_at` | timestamptz | NOT NULL DEFAULT now() |

RLS aan, **geen policies**, `REVOKE ALL ... FROM anon, authenticated;`
Trigger `set_updated_at` BEFORE UPDATE → bestaande functie `public.update_updated_at()`.

### 2.3 `public.platform_webhook_config`

| Kolom | Type | Regels |
|---|---|---|
| `id` | boolean | PK DEFAULT true, CHECK `(id)` → maximaal één rij |
| `auth_header` | text | NOT NULL DEFAULT `'X-Webhook-Token'` |
| `token` | text | NOT NULL DEFAULT `''` (write-only) |
| `document_webhook_url` | text | nullable |
| `updated_at` | timestamptz | NOT NULL DEFAULT now() |

RLS aan, **geen policies**, `REVOKE ALL ... FROM anon, authenticated;`
Trigger `set_updated_at` BEFORE UPDATE → `public.update_updated_at()`.
Bij aanmaken direct één rij: `INSERT ... (id) VALUES (true) ON CONFLICT DO NOTHING;`

### 2.4 `public.ai_assistants` (wijziging)

| Wijziging | Detail |
|---|---|
| `catalog_id` | uuid, FK → `assistant_catalog(id)`; na datavulling `SET NOT NULL` |
| `UNIQUE (organization_id, catalog_id)` | constraint `ai_assistants_organization_id_catalog_id_key`; tevens het `ON CONFLICT`-doel |
| `organization_id`, `name`, `icon`, `type`, `example_questions`, `system_prompt`, `is_active`, `created_by`, `n8n_webhook_url` | blijven ongewijzigd; `n8n_webhook_url` blijft bestaan maar wordt niet meer gelezen |

## 3. RLS-wijzigingen op `ai_assistants`

| Policy | Commando | Actie |
|---|---|---|
| `Admins can create assistants in their org` | INSERT | **DROP** (route) |
| `Admins can update assistants in their org` | UPDATE | **DROP** (route) |
| `Admins can delete assistants in their org` | DELETE | **DROP** (route) |
| `Users can create assistants` | INSERT | **DROP** (drift, bevestigd) |
| `Users can update assistants` | UPDATE | **DROP** (drift, bevestigd) |
| `Users can delete assistants` | DELETE | **DROP** (drift, bevestigd) |
| `Users can view assistants` | SELECT | **blijft** (lezen binnen eigen organisatie) |

Na de migratie heeft `ai_assistants` geen INSERT/UPDATE/DELETE-policy meer → standaard
geweigerd voor `anon` en `authenticated`. Schrijven gebeurt uitsluitend via SECURITY DEFINER
functies met de service role. `assistant_knowledge_bases` blijft volledig ongewijzigd.

### RLS-matrix na de migratie

| Tabel | anon | authenticated (lid) | authenticated (kantoorbeheerder) | service_role |
|---|---|---|---|---|
| `ai_assistants` SELECT | — | eigen org | eigen org | alles |
| `ai_assistants` INSERT/UPDATE/DELETE | — | — | — | alles |
| `assistant_catalog` | — | — | — | alles |
| `platform_webhook_config` | — | — | — | alles |
| `platform_admins` | — | — | — | alles |
| `assistant_knowledge_bases` INSERT/DELETE | — | eigen org (bestaand) | eigen org (bestaand) | alles |
| `flow_configs` | — | bestaand | bestaand | alles (niet meer gebruikt) |

`service_role` behoudt zijn tabelrechten via de Supabase-default-privileges en omzeilt RLS; de
SECURITY DEFINER-functies worden door de migration-runner (tabeleigenaar) uitgevoerd en kunnen
de nieuwe tabellen daarom lezen en schrijven.

## 4. Functies

### 4.1 `public.is_platform_admin()`

```sql
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
$$;
REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;
```

### 4.2 `public.platform_save_catalog_assistant(...)`

Signatuur: `(p_id uuid, p_name text, p_description text, p_icon text, p_type text,
p_example_questions text[], p_actor uuid) RETURNS uuid`.

```sql
CREATE OR REPLACE FUNCTION public.platform_save_catalog_assistant(
  p_id uuid, p_name text, p_description text, p_icon text, p_type text,
  p_example_questions text[], p_actor uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
  v_icon text := coalesce(nullif(btrim(coalesce(p_icon, '')), ''), '🤖');
  v_questions text[] := coalesce(p_example_questions, '{}');
BEGIN
  IF v_name = '' THEN RAISE EXCEPTION 'name_required'; END IF;
  IF p_type NOT IN ('chat','agent','voice','risico_analyse') THEN
    RAISE EXCEPTION 'invalid_type';
  END IF;
  IF coalesce(array_length(v_questions, 1), 0) > 4 THEN
    RAISE EXCEPTION 'too_many_example_questions';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.assistant_catalog
      (name, description, icon, type, example_questions)
    VALUES (v_name, p_description, v_icon, p_type, v_questions)
    RETURNING id INTO v_id;

    INSERT INTO public.ai_assistants
      (organization_id, catalog_id, name, description, icon, type,
       example_questions, system_prompt, is_active, created_by)
    SELECT o.id, v_id, v_name, p_description, v_icon, p_type,
           v_questions, '', true, p_actor
    FROM public.organizations o
    ON CONFLICT (organization_id, catalog_id) DO NOTHING;
  ELSE
    UPDATE public.assistant_catalog
       SET name = v_name, description = p_description, icon = v_icon,
           type = p_type, example_questions = v_questions
     WHERE id = p_id
     RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;

    UPDATE public.ai_assistants
       SET name = v_name, description = p_description, icon = v_icon,
           type = p_type, example_questions = v_questions
     WHERE catalog_id = v_id;
  END IF;

  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION
  public.platform_save_catalog_assistant(uuid, text, text, text, text, text[], uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.platform_save_catalog_assistant(uuid, text, text, text, text, text[], uuid)
  TO service_role;
```

Voorwaarde: `p_actor` is een bestaand `profiles.id` (FK `created_by`). De Edge Function geeft
de `auth.uid()` van de aanroeper mee.

### 4.3 `public.platform_seed_org_assistants(p_org uuid, p_actor uuid)`

```sql
CREATE OR REPLACE FUNCTION public.platform_seed_org_assistants(
  p_org uuid, p_actor uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.ai_assistants
    (organization_id, catalog_id, name, description, icon, type,
     example_questions, system_prompt, is_active, created_by)
  SELECT p_org, c.id, c.name, c.description, c.icon, c.type,
         c.example_questions, '', true, p_actor
  FROM public.assistant_catalog c
  ON CONFLICT (organization_id, catalog_id) DO NOTHING;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.platform_seed_org_assistants(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_seed_org_assistants(uuid, uuid) TO service_role;
```

## 5. Datavulling (zelfde migratie)

### 5.1 Catalogusitems (bevestigde koppeltabel)

| Naam | Type | Icon | Beschrijving | Vragen | Productie-URL |
|---|---|---|---|---|---|
| acceptatie | chat | 🤖 | NULL | `{}` | `https://process.jaaphoeve.com/webhook/e561c3e8-2c61-4272-8dde-50423c85e0b3` |
| Acceptatiehandboek | chat | 🤖 | NULL | `{}` | idem |
| Acceptatiehandboek Particulier en Zakelijk | chat | 🤖 | NULL | `{}` | idem |
| Risico analyse | risico_analyse | 🤖 | NULL | `{}` | NULL |
| Schade | chat | 🤖 | NULL | `{}` | idem |

Test-URL: `NULL` voor alle vijf (bestaat nog niet).

### 5.2 Bestaande rijen koppelen (expliciete id's)

| `ai_assistants.id` | Organisatie | Catalogusitem |
|---|---|---|
| `2b3ba047-b9a5-49e8-91ac-11234c99dd3b` | Darwin | acceptatie |
| `c26d93d8-f709-4b8c-8e0e-5e0b0341dfce` | Darwin | Risico analyse |
| `52c493c5-75de-4461-bce1-f92b14cc1d5f` | Darwin | Schade |
| `2854d916-42aa-44d0-9e88-7dd04544c218` | Gerard_Tekelenburg | Acceptatiehandboek |
| `f49f8190-94b3-4a9b-acf7-732e8c80467f` | Gerard_Tekelenburg | Acceptatiehandboek Particulier en Zakelijk |

```sql
UPDATE public.ai_assistants SET catalog_id =
  (SELECT id FROM public.assistant_catalog WHERE name = 'acceptatie' AND type = 'chat')
WHERE id = '2b3ba047-b9a5-49e8-91ac-11234c99dd3b';
-- idem voor de vier andere rijen
```

### 5.3 Ontbrekende combinaties uitzetten

```sql
INSERT INTO public.ai_assistants
  (organization_id, catalog_id, name, description, icon, type,
   example_questions, system_prompt, is_active, created_by)
SELECT o.id, c.id, c.name, c.description, c.icon, c.type, c.example_questions, '',
       false,
       (SELECT p.id FROM public.profiles p
         WHERE p.organization_id = o.id AND p.role = 'admin'
         ORDER BY p.created_at LIMIT 1)
FROM public.organizations o
CROSS JOIN public.assistant_catalog c
ON CONFLICT (organization_id, catalog_id) DO NOTHING;
```

Resultaat (5 nieuwe rijen, allemaal `false`):

| Organisatie | Aan | Uit |
|---|---|---|
| Darwin | acceptatie, Risico analyse, Schade | Acceptatiehandboek, Acceptatiehandboek Particulier en Zakelijk |
| Gerard_Tekelenburg | Acceptatiehandboek, Acceptatiehandboek Particulier en Zakelijk | acceptatie, Risico analyse, Schade |

Daarna: `ALTER TABLE public.ai_assistants ALTER COLUMN catalog_id SET NOT NULL;`

### 5.4 Centrale koppeling vullen (token nooit in het bestand)

```sql
INSERT INTO public.platform_webhook_config (id, auth_header, token, document_webhook_url)
SELECT true,
       coalesce((SELECT webhook_auth_header FROM public.flow_configs
                  WHERE flow_type = 'rag_chat' AND webhook_token <> ''
                  ORDER BY updated_at DESC LIMIT 1), 'X-Webhook-Token'),
       coalesce((SELECT webhook_token FROM public.flow_configs
                  WHERE flow_type = 'rag_chat' AND webhook_token <> ''
                  ORDER BY updated_at DESC LIMIT 1), ''),
       (SELECT webhook_url FROM public.flow_configs
         WHERE flow_type = 'document_processing'
         ORDER BY updated_at DESC LIMIT 1)
ON CONFLICT (id) DO NOTHING;
```

Uitkomst voor deze omgeving: headernaam `X-Webhook-Token`, token = het enige niet-lege token
(md5 `677a3696441289abc41230b3df520910`), document-URL
`https://process.jaaphoeve.com/webhook/86ff1d2c-1d14-40d1-83ba-7b1def357331`.

### 5.5 Platformbeheerder toevoegen

```sql
INSERT INTO public.platform_admins (user_id)
SELECT id FROM auth.users WHERE email = '<PLATFORM_ADMIN_EMAIL>'
ON CONFLICT (user_id) DO NOTHING;
```

`<PLATFORM_ADMIN_EMAIL>` wordt vóór het toepassen ingevuld met het bevestigde adres. De
bijbehorende `profiles`-rij moet bestaan (nodig voor `created_by` en voor kenniskoppelingen).

## 6. Toestandsovergangen

| Entiteit | Van | Actie | Na | Voorwaarde |
|---|---|---|---|---|
| Organisatiebeschikbaarheid | aan | schakelaar uit (platformbeheerder) | uit | rij bestaat; server update 1 rij |
| Organisatiebeschikbaarheid | uit | schakelaar aan | aan | idem; assistent direct zichtbaar |
| Catalogusitem | bestaat | definitie bewerken | bestaat, nieuwe waarden overal | platformbeheerder; alle `ai_assistants`-rijen bijgewerkt |
| Catalogusitem | bestaat | nieuwe assistent | bestaat, bij alle orgs aan | platformbeheerder; één rij per organisatie |
| Koppelingen | leeg | opslaan | gevuld | URL's geldig; leeg token behoudt bestaande |
| Koppelingen | gevuld | token leeg opslaan | ongewijzigd token | bestaand token blijft |
| Kennisbronkoppeling | gekoppeld | assistent uit | koppeling blijft | heractiveren herstelt gebruik |
| Gesprek | bestaat | assistent uit | leesbaar, geen nieuw bericht | servercontrole `is_active` |

## 7. Validatieregels (server-side)

| Veld | Regel | Foutcode |
|---|---|---|
| `prod_webhook_url`, `document_webhook_url` | leeg → NULL; anders https, geen localhost/.local/.internal, geen letterlijk IP, geen `/webhook-test/` | `VALIDATION` |
| `test_webhook_url` | als productie-URL, maar `/webhook-test/` toegestaan | `VALIDATION` |
| `auth_header` | leeg → `X-Webhook-Token` | — |
| `token` | leeg/afwezig → bestaand token behouden | — |
| `name` | niet leeg na trim | `VALIDATION` |
| `type` | `chat`,`agent`,`voice`,`risico_analyse` | `VALIDATION` |
| `example_questions` | max 4 | `VALIDATION` |
| `organization_id`, `catalog_id` | bestaande uuid | `VALIDATION` |

## 8. Verificatiequeries (na de migratie)

```sql
-- 1. Elke rij heeft een catalogusitem; geen dubbele combinaties
SELECT count(*) FILTER (WHERE catalog_id IS NULL) AS zonder_catalogus,
       count(*) AS totaal FROM public.ai_assistants;

-- 2. Actieve set per organisatie is gelijk aan de oude situatie
SELECT o.name, count(*) FILTER (WHERE a.is_active) AS actief
FROM public.organizations o JOIN public.ai_assistants a ON a.organization_id = o.id
GROUP BY o.name ORDER BY o.name;

-- 3. Geen schrijfpolicies meer
SELECT policyname, cmd FROM pg_policies
WHERE schemaname='public' AND tablename='ai_assistants' AND cmd <> 'SELECT';

-- 4. Koppeling gevuld zonder het token te tonen
SELECT auth_header, (token <> '') AS has_token, document_webhook_url
FROM public.platform_webhook_config;

-- 5. Precies één platformbeheerder
SELECT count(*) FROM public.platform_admins;
```
