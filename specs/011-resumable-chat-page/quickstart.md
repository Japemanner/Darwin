# Quickstart & Rollout: 011-resumable-chat-page

**Date**: 2026-10-16 | **Feature**: [spec.md](spec.md)

Handmatige stappen voor Jaap. Dit Supabase-project is **productie**; de volgorde
hieronder is verplicht. Dankzij het legacy-pad in de Edge Function (research #4) is
de rollout breukloos: de huidige productieclient blijft tijdens de hele overgang
werken.

## 1. Voorbereiding

- Geen nieuwe secrets: de Edge Function gebruikt dezelfde omgevingsvariabelen als
  v1 (`SUPABASE_URL`/`VITE_SUPABASE_URL`, `SUPABASE_ANON_KEY`/`VITE_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`/`VITE_SUPABASE_SERVICE_ROLE_KEY`, `ALLOWED_ORIGINS`).
- E2E-accounts: bestaande `E2E_EMAIL`/`E2E_PASSWORD` volstaan (admin voor
  voorbeeldvragen-instelling; member niet vereist voor deze specs).
- Zorg dat voor de handmatige persistentie-check (§3, stap 4) minstens één actieve
  chat-assistent met een werkende n8n-koppeling bestaat.

## 2. Lokale ontwikkeling en geautomatiseerde checks

```bash
npx tsc --noEmit
npx eslint src/ --max-warnings 0
npm run build
npx playwright test tests/e2e/chat-page.spec.ts          # 4 nieuwe gevallen (route-item 5)
npx playwright test                                      # volledige regressiesuite (incl. herwerkte specs)
```

Alle e2e-tests mocken Supabase-REST en rag-chat via `page.route`; er wordt geen
testdata in productie geschreven.

## 3. Releasevolgorde (verplicht)

| Stap | Actie | Waarom |
|------|-------|--------|
| 1 | Migratie `016_assistant_example_questions.sql` toepassen via de **Supabase MCP** | Kolom met `DEFAULT '{}'` is op zichzelf staand veilig; frontend valt terug op lege lijst zolang de kolom er nog niet is (`?? []`) |
| 2 | Edge Function `rag-chat` v2 deployen (Supabase MCP) | Legacy-pad houdt de huidige productieclient volledig werkend: requests zonder `message_id` krijgen v1-gedrag en v1-respons |
| 3 | Frontend-PR naar `develop` → preview testen → merge naar `main` (Netlify) | Activeert de feature: chatpagina-routes, message_id-flow, voorbeeldvragen. Na deze stap gebruikt iedereen v2 en is er niets meer gebroken |
| 4 | **Handmatige persistentie-verificatie met de échte Edge Function** (hieronder §4) | De e2e-suite is volledig gemocked; opslag, hervatbaarheid en het vaste adres moeten eenmalig live worden bewezen (randvoorwaarde uit de opdracht) |
| 5 | Supabase MCP-verificatie: RLS enabled (F-01) op `ai_assistants`/`conversations`/`messages`; fitness-check + FEATURES.md via `@fitness-checker` | Constitution: RLS/bucket-verificatie na elke feature |

## 4. Handmatige verificatie met de echte Edge Function (na stap 3, ±10 min)

1. **Vast adres + hervatten**: open de app → assistent → "Chat" → stel een vraag →
   adresbalk toont `/chat/<uuid>` (alleen id's). Herlaad (F5): gesprek compleet
   terug, vervolgvraag mogelijk. Browser-terug: assistentenoverzicht; browser-vooruit:
   gesprek intact. Log uit, log in, open hetzelfde adres: gesprek voortzetbaar.
2. **Serverside opslag**: stel een tweede vraag en controleer in de database (of via
   de Geschiedenis-pagina) dat zowel vraag als antwoord zijn opgeslagen — niet eerder
   en niet dubbel.
3. **Idempotie**: verbreek bij een volgende vraag de verbinding met n8n (bijv. de
   webhook tijdelijk stoppen) → inline fout met "Opnieuw proberen" verschijnt bij de
   vraag (geen toast) → start n8n weer → klik "Opnieuw proberen" → antwoord
   verschijnt en de vraag staat exact één keer in het gesprek.
4. **Vreemd gesprek**: open (ingelogd als gebruiker A) een gespreks-URL van
   gebruiker B → "Gesprek niet gevonden", geen lege pagina.
5. **Voorbeeldvragen**: als admin → assistent bewerken → 2–4 voorbeeldvragen invullen
   (één per regel) → opslaan → als gebruiker nieuw gesprek openen → vragen staan als
   knoppen → klik verstuurt de vraag direct. Meer dan 4 invullen wordt geblokkeerd
   bij het opslaan.
6. **Composer**: Shift+Enter geeft een nieuwe regel (veld groeit mee tot ±8 regels),
   Enter verstuurt, focus staat na het versturen weer in het invoerveld; alle acties
   (opnieuw proberen, kopiëren, voorbeeldvraag, nieuw gesprek) per tab bereikbaar.
7. **Kopieerknop**: "Kopiëren" onder een antwoord → toast "Gekopieerd" → plakken
   levert de volledige antwoordtekst.
8. **Wachtmelding**: stel een vraag waarvan het antwoord > 15 s duurt (of verlaag
   tijdelijk de n8n-reactie) → na 15 s verschijnt "Dit duurt langer dan gebruikelijk."
   onder "Antwoord wordt opgesteld…" en verdwijnt bij het antwoord.

## 5. Verificatie met SQL (na stap 1)

```sql
-- Kolom bestaat met default:
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'ai_assistants'
  AND column_name = 'example_questions';
-- Verwacht: text, '{}'::text[], NO

-- RLS staat nog aan (F-01):
SELECT relname, relrowsecurity FROM pg_class
WHERE relname IN ('ai_assistants', 'conversations', 'messages');
-- Verwacht: true × 3

-- Nieuwe gesprekken hebben de vraag als titel (na stap 4):
SELECT id, title, created_at FROM conversations
ORDER BY created_at DESC LIMIT 5;
-- Verwacht: titel = eerste vraag, max 80 tekens + '…' bij afkapping

-- Geen dubbele gebruikersberichten per gespreksbeurt (na stap 4.3):
SELECT conversation_id, id, role, content IS NOT NULL AS has_content, created_at
FROM messages ORDER BY created_at DESC LIMIT 10;
-- Verwacht: elke retry-hoort-samen-vraag komt één keer voor; antwoorden volgen op vragen
```

## 6. Rollback (bij nood)

- **Migratie 016**: omkeerbaar met
  `ALTER TABLE ai_assistants DROP COLUMN IF EXISTS example_questions;` (kolom is
  additief; data-verlies beperkt zich tot de ingestelde voorbeeldvragen).
- **Edge Function v2**: her-deploy van de v1-bron (`git show 009..:supabase/functions/rag-chat/index.ts`
  of de vorige functie-revolutie); het v2-pad is geïsoleerd achter de
  `message_id`-aanwezigheid, dus v1 terugzetten is voldoende.
- **Frontend**: revert van de merge naar `main` (Netlify rollback); de oude
  chat-flow (zijpaneel) verdwijnt uit de bundel zodra ChatWindow is verwijderd —
  vóór die verwijdering is een revert een gewone `git revert` van de feature-merge.