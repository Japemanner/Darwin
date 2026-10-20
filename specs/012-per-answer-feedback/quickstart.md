# Quickstart & Rollout: 012-per-answer-feedback

**Date**: 2026-10-19 | **Feature**: [spec.md](spec.md)

Handmatige stappen voor Jaap. Dit Supabase-project is **productie**; de volgorde
hieronder is verplicht. Let op het breekraam in stap 1→3: zodra de migratie is
toegepast kan de oude gespreksbrede feedbackbalk (nog in de productiebundel) geen
nieuwe feedback meer opslaan (RLS, research #13) — de nieuwe frontend moet snel
volgen. Bestaande feedback en de overige app blijven onaangetast.

## 1. Voorbereeding

- Geen nieuwe secrets en geen nieuwe dependencies.
- E2E-accounts: bestaande `E2E_EMAIL`/`E2E_PASSWORD` volstaan (de nieuwe spec seedt
  zelf via dit account). Lokaal draaien de tests tegen `.env.local`.
- Besef: `answer-feedback.spec.ts` schrijft testdata (gesprek + berichten + feedback)
  naar het productieproject en ruimt die zelf weer op via één gespreks-delete (cascade).
  Herkenbare titels ("E2E …").

## 2. Lokale ontwikkeling en geautomatiseerde checks

```bash
npx tsc --noEmit
npx eslint src/ --max-warnings 0
npm run build
npx playwright test tests/e2e/answer-feedback.spec.ts   # 4 nieuwe gevallen (route-item 4)
npx playwright test                                      # volledige regressiesuite
```

De nieuwe spec gebruikt de echte database (seeding via de Supabase-client van het
testaccount, research #12); de overige specs blijven volledig gemocked.

## 3. Releasevolgorde (verplicht)

| Stap | Actie | Waarom |
|------|-------|--------|
| 1 | Migratie `017_per_answer_feedback.sql` toepassen via de **Supabase MCP** | Kolommen zijn additief/nullable; de nieuwe frontend en Edge Function hebben ze nodig (anders 42703). Oude balk faalt hierna op inserts (raam tot stap 3, research #13) |
| 2 | Edge Function `rag-chat` deployen (Supabase MCP) | Slaat `rewritten_query`, `verification`, `latency_ms` bij het assistentbericht (FR-010); responscontract ongewijzigd |
| 3 | Frontend-PR naar `develop` → preview testen → merge naar `main` (Netlify) | Activeert per-antwoord feedback en verwijdert de gespreksbrede balk (FR-009); raam uit stap 1 sluit |
| 4 | Handmatige verificatie (§4) + Supabase MCP-controle: RLS enabled (F-01) op `messages`/`feedback_interactions`; fitness-check + FEATURES.md via `@fitness-checker` | Constitution: RLS-verificatie na elke feature |

## 4. Handmatige verificatie (na stap 3, ±10 min)

1. **Per antwoord**: open een gesprek met minimaal twee antwoorden → duim omhoog op
   het eerste antwoord → alleen dat antwoord markeert; tweede antwoord onbeoordeeld.
2. **Duim omlaag met reden**: klik omlaag → kies "Onvolledig", laat de toelichting
   leeg → "Versturen" → oordeel opgeslagen. "Annuleren" ertussen slaat niets op.
3. **Wijzigen**: zet omlaag→omhoog (reden/toelichting vervallen) en omhoog→omlaag
   met nieuwe reden → er blijft per antwoord precies één oordeel bestaan.
4. **Herladen**: F5 → de actieve duim staat per antwoord nog (aria-pressed), reden
   en toelichting zijn bewaard (controleer in de database: `SELECT reason, feedback,
   updated_at FROM feedback_interactions WHERE message_id = '<uuid>'`).
5. **Antwoordgegevens**: stel een echte vraag (werkende n8n-koppeling) → controleer
   in de database dat `rewritten_query`, `verification` en `latency_ms` bij het
   nieuwe antwoord staan; een antwoord van vóór de feature heeft NULL's.
6. **Toegankelijkheid**: tab door de duimknoppen en het redenformulier — focus
   zichtbaar, radios met pijltjes bedienbaar, labels voorleesbaar.
7. **Beheerdersoverzicht**: als beheerder in de SQL-editor:
   `SELECT * FROM get_feedback_review();` → alleen negatieve per-antwoord-oordelen
   van de eigen organisatie, met vraag, antwoord, verificatie, herschreven zoekvraag
   en responstijd. Als gewone gebruiker: lege resultatenset.
8. **RLS-grens** (optioneel, SQL-editor met anon-JWT van een andere gebruiker):
   upsert op een bericht uit een vreemd gesprek → 42501 permission denied.

## 5. Verificatie met SQL (na stap 1)

Zie het verificatieblok onderaan [data-model.md](data-model.md) (kolommen,
constraint/index, RLS-aan, policies). Aanvullend na stap 2:

```sql
-- Nieuwste antwoorden hebben antwoordgegevens:
SELECT role, rewritten_query IS NOT NULL AS has_rq, verification IS NOT NULL AS has_v,
       latency_ms
FROM messages WHERE role = 'assistant' ORDER BY created_at DESC LIMIT 3;
-- Verwacht: has_rq/has_v naar gelang de koppeling levert; latency_ms gevuld

-- Per antwoord maximaal één oordeel per gebruiker:
SELECT message_id, user_id, count(*) FROM feedback_interactions
WHERE message_id IS NOT NULL GROUP BY 1, 2 HAVING count(*) > 1;
-- Verwacht: 0 rijen
```

## 6. Rollback (bij nood)

- **Migratie 017**: omkeerbaar met `DROP FUNCTION get_feedback_review();`,
  `DROP POLICY "Users can insert feedback on own conversation messages" …`,
  `DROP POLICY "Users can update own feedback" …` + kolommen/constraint/index/trigger
  laten vallen en de oude constraint+insert-policy terugzetten (004-bron). Nieuwere
  per-antwoord-rijen raken dan hun reason/upsert-basis kwijt — terugdraaien is
  alleen zinrijk vóór breed gebruik.
- **Edge Function**: vorige functie-revolutie her-deployen via MCP; de drie nieuwe
  kolommen blijven leeg (harmless).
- **Frontend**: revert van de merge naar `main` (Netlify rollback). Let op: mét de
  migratie actief faalt de oude gespreksbrede balk dan weer op inserts (raam uit §3);
  draai in dat geval ook de policy-wijzigingen uit de migratie terug.