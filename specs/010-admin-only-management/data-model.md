# Data Model: Beheerfuncties alleen voor beheerders

**Date**: 2026-10-15 | **Feature**: [spec.md](spec.md) | **Branch**: `010-admin-only-management`

## Overzicht

Deze feature voegt **geen tabellen of kolommen** toe. Alle entiteiten en hun
velden zijn ongewijzigd; wat verandert zijn de toegangsrechten: RLS-policies
(schrijven) en storage-policies. Het enige nieuwe database-object is de
helper-functie `is_org_admin()`.

## Entiteiten (ongewijzigd, voor referentie)

| Entiteit | Tabel | Sleutelvelden | Relaties |
|---|---|---|---|
| Organisatie | `organizations` | `id`, `name` | verwerkt alles |
| Profiel (met rol) | `profiles` | `id`, `organization_id`, `role` (`admin` \| `member`) | extends `auth.users`, hoort bij organisatie |
| Assistent | `ai_assistants` | `id`, `organization_id`, `name`, `description?`, `system_prompt`, `type` (`chat`\|`agent`\|`voice`\|`risico_analyse`), `icon`, `n8n_webhook_url`, `is_active`, `created_by` | 1 organisatie → N assistenten; N↔N kennisbronnen |
| Kennisbron | `knowledge_bases` | `id`, `organization_id`, `name`, `description?`, `created_by` | 1 organisatie → N bronnen |
| Document | `knowledge_base_documents` | `id`, `knowledge_base_id`, `organization_id` (007-M1), `name`, `file_path`, `file_type`, `file_size`, `status` (`processing`\|`ready`\|`error`), `created_by` | hoort bij kennisbron; bestand in bucket `knowledge-documents` |
| Kennisitem | `knowledge_items` | `id`, `knowledge_base_id`, `title`, `content`, `embedding_status` (`pending`\|`processing`\|`done`\|`failed`) | tekstkennis binnen een bron |
| Koppeling | `assistant_knowledge_bases` | `assistant_id` + `knowledge_base_id` (PK) | N↔N assistent↔kennisbron |
| Gesprek | `conversations` | `id`, `user_id`, `assistant_id`, `title` | eigendom gebruiker; ongewijzigd beleid |
| Bericht | `messages` | `id`, `conversation_id`, `role`, `content` | ongewijzigd beleid |
| Feedback | `feedback_interactions` (004) | — | ongewijzigd beleid |
| Documentopslag | `storage.objects` (bucket `knowledge-documents`) | pad: `<org_id>/…` | private bucket, org-pad-gebaseerd |

## Nieuw database-object

```sql
-- 015_admin_only_writes.sql
CREATE OR REPLACE FUNCTION is_org_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

Consistent met het bestaande `get_user_org_id()`-patroon
(`supabase/migrations/001_initial_schema.sql:171-174`): STABLE zodat PostgreSQL
de functie per statement cacht; SECURITY DEFINER zodat de aanroepende policy
geen RLS-afhankelijkheid op `profiles` krijgt (geen recursierisico — de
profiles-policies verwijzen niet terug naar de beheertabellen).

## RLS-policy-matrix: voor → na

> N = ongewijzigd. Rood/oranje = vervangen in `015_admin_only_writes.sql`.
> Alle admin-only-policies combineren de bestaande org-scope
> (`organization_id = get_user_org_id()` of het bestaande EXISTS-pad) met
> `AND is_org_admin()` — een admin van organisatie A krijgt dus géén rechten
> op organisatie B (multitenancy blijft waterdicht).

| Tabel | Operatie | Voor | Na |
|---|---|---|---|
| `ai_assistants` | SELECT | org (`001:214-216`) | idem — N |
| | INSERT | org (`001:218-220`) | org + admin |
| | UPDATE | org (`001:222-224`) | org + admin (USING + WITH CHECK) |
| | DELETE | org (`001:226-228`) | org + admin |
| `knowledge_bases` | SELECT | org (`001:231-233`) | idem — N |
| | INSERT | org (`001:235-237`) | org + admin |
| | UPDATE | org (`001:239-241`) | org + admin |
| | DELETE | org (`001:243-245`) | org + admin |
| `knowledge_base_documents` | SELECT | org via `organization_id` (`007:217-219`) | idem — N |
| | INSERT | org (`007:221-223`) | org + admin |
| | UPDATE | géén policy (default deny) | idem — N (statusupdates lopen via service role, niet via client) |
| | DELETE | org (`007:225-227`) | org + admin |
| `knowledge_items` | SELECT | org via KB-join (`002:90-99`) | idem — N |
| | INSERT | org via KB-join (`002:101-109`) | idem + admin |
| | UPDATE | géén policy (default deny) | idem — N |
| | DELETE | org via KB-join (`002:111-116`) | idem + admin |
| `assistant_knowledge_bases` | SELECT | dubbele org-check (`007:141-154`) | idem — N |
| | INSERT | dubbele org-check (`007:157-170`) | idem + admin |
| | DELETE | dubbele org-check (`007:173-186`) | idem + admin |
| `conversations` | alle | eigenaars (`001:309-320`, `007:127-129`) | idem — N (FR-010) |
| `messages` | SELECT/INSERT | eigen gesprek (`001:323-340`) | idem — N (FR-010) |
| `feedback_interactions` | alle | eigen (`004`) | idem — N (FR-010) |
| `invitations` | alle | admin (`001:192-211`) | idem — N |
| `storage.objects` (bucket) | SELECT | org-pad (`007:92-98`) | idem — N |
| | INSERT (upload) | org-pad (`007:83-89`) | org-pad + admin |
| | UPDATE | org-pad (`007:110-121`) | org-pad + admin — dicht het omzeilgat: anders zou een member een bestaand document kunnen overschrijven |
| | DELETE | org-pad (`007:101-107`) | org-pad + admin |

**Belangrijke invarianten**:

1. **Alles wat een member vóór 015 kon, en dat géén beheer is, blijft werken**:
   lezen binnen de eigen organisatie (FR-009), eigen gesprekken, berichten,
   feedback (FR-010), profiel-updates, chat- en analyseflows.
2. **Alles wat een admin vóór 015 kon, blijft werken** (FR-011): de
   admin-only-policies zijn strikte subsets-plus-beperking van de oude
   org-policies; org-scope blijft ongewijzigd, alleen de rol-check komt erbij.
3. **Edge functions en de Darwin-API (service role) worden niet geraakt** —
   service role omzeilt RLS; documentstatus- en embeddingstatus-schrijfacties
   blijven functioneren.
4. **De 15 weigeringen (SC-001)** vloeien direct uit de matrix: 5 tabellen ×
   INSERT/UPDATE/DELETE. Voor `knowledge_base_documents`-UPDATE en
   `knowledge_items`-UPDATE blijft dat een default-deny (géén policy), wat
   dezelfde RLS-weigering oplevert voor een member (en al zo was voor iedereen
   via de client).

## Migratievolgorde en rollback

- Migratie `015_admin_only_writes.sql` is een enkele transactionele batch
  (BEGIN/COMMIT) van DROP + CREATE policies en één functie; idempotent door
  `DROP POLICY IF EXISTS`.
- Rollback = migratie 014-stand herstellen: policies opnieuw aanmaken zonder
  de rol-check (de oude definities staan in `001`, `002` en `007`).
- Uitvoeren via de Supabase MCP (AGENTS.md: alle schema-wijzigingen via MCP);
  volgorde en vensters: zie [quickstart.md](quickstart.md).