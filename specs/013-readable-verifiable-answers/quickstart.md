# Quickstart & Rollout: 013-readable-verifiable-answers

**Date**: 2026-10-29 | **Feature**: [spec.md](spec.md)

Handmatige stappen voor Jaap. Deze feature is **volledig frontend**: geen migraties,
geen Edge Function-deploy, geen env- of Supabase-wijzigingen, geen nieuwe dependencies.
Daarom is er géén breekraam en geen releasevolgorde — één frontend-PR volstaat.

## 1. Voorbereiding

- Geen nieuwe secrets, geen nieuwe dependencies (`npm install` niet nodig).
- E2E draait tegen de bestaande accounts: `E2E_EMAIL`/`E2E_PASSWORD`
  (alle nieuwe gevallen zijn volledig gemocked — geen testdata in Supabase).
- De nieuwe spec hergebruikt het mock-patroon uit `rag-chat.spec.ts`
  (`page.route` op REST + edge function).

## 2. Lokale ontwikkeling en geautomatiseerde checks

```bash
npx tsc --noEmit
npx eslint src/ --max-warnings 0
npm run build
npx playwright test tests/e2e/answer-presentation.spec.ts   # nieuwe gevallen (route-item 5)
npx playwright test tests/e2e/rag-chat.spec.ts               # aangepaste bronassertie
npx playwright test                                         # volledige regressiesuite
```

## 3. Release

| Stap | Actie | Waarom |
|------|-------|--------|
| 1 | Frontend-PR naar `develop` → preview testen (Netlify) | Frontend-only; geen serveronderdelen, dus geen volgorde-afhankelijkheid |
| 2 | Merge naar `main` (via PR) | Activeert markdown-weergave, CONCEPT-label, verificatieregel, bronknoppen + paneel; verwijdert score-badge en uitklaplijst |
| 3 | Handmatige verificatie (§4) + fitness-check + FEATURES.md via `@fitness-checker` | Constitution: feature-afsluiting vereist fitness-check (Supabase RLS F-01/buckets F-10 ongewijzigd — geen DB-wijzigingen om te verifieren) |

## 4. Handmatige verificatie (na stap 2, ±10 min)

1. **Markdown + CONCEPT**: stel een vraag waarop het antwoord opsommingen/vet bevat →
   het antwoord toont echte opmaak (géén sterretjes) en draagt het CONCEPT-label.
2. **Verificatieregel**: een onderbouwd antwoord toont "Gecontroleerd tegen de
   bronnen"; een antwoord zonder verificatiegegevens toont géén regel en géén fout.
   (De waarschuwing bij `grounded = false` is in productie niet op bestelling te
   forceren — de e2e dekt dit gemocked; bekijk zo nodig een antwoord met lage
   confidence in de praktijk.)
3. **Bronpaneel**: klik bronknop `[1] <documentnaam>` → zijpaneel toont Referentie,
   Document en Letterlijke passage (géén Locatie zolang n8n die niet levert; géén
   percentage) → Escape sluit en de focus staat terug op de bronknop.
4. **Letterlijke vraag**: typ een vraag met regeleinden en een tekst als
   `<b>test</b>` → de vraag staat letterlijk in de chat, niet als opmaak.
5. **Herladen**: F5 op een bestaand gesprek → antwoorden met opgeslagen verificatie
   tonen de verificatieregel; oude antwoorden zónder verificatie tonen niets en
   veroorzaken géén foutmelding.
6. **Toetsenbord**: tab naar een bronknop → Enter opent het paneel → Escape sluit →
   focus terug op de bronknop.

## 5. Rollback

Frontend-only: revert van de merge-PR naar `main` zet de oude weergave (sanitizeHtml,
score-badge, uitklaplijst) terug. Geen data-effecten — er is niets gemigreerd of
geherstructureerd; oude en nieuwe berichten blijven ongewijzigd leesbaar.

## 6. Bekende afhankelijkheden buiten deze feature

- Bron-`page`/locatie verschijnt pas zodra n8n die meelevert (expliciet buiten scope);
  het paneel verbergt Locatie tot dat moment.
- De waarschuwingsdrempel (`0,7`) is frontend-constante; bijstellen ervan is een
  bewuste code-wijziging (zoals de spec het acceptatiecriterium bedoelt).
- `AnalysisMarkdown` gebruikt inerte `prose`-classes (plugin niet geïnstalleerd) —
  bestaand tekort buiten deze scope, benoemd in research #2; laten voor een aparte
  beslissing.