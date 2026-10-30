# Beslissing: 013-release direct naar main — develop-preview overgeslagen op eigenaarsinstructie

**Datum**: 2026-10-29 | **Feature**: 013-readable-verifiable-answers

## Decision

De release van 013 vond op één dag plaats: PR (feature → develop) en direct daarna de
develop → main release-PR, zonder de tussenliggende Netlify-preview-teststap op develop.
Expliciete instructie van de eigenaar ("ga door en commit op main").

## Context

Frontend-only feature: geen migraties, Edge Functions of bucket-wijzigingen — er is geen
breekraam en geen releasevolgorde-afhankelijkheid (quickstart §3). Alle lokale gates
groen: tsc 0 fouten, eslint 0 errors (6 pre-existing baseline-warnings, geen nieuwe),
build groen (4,1 s), fitness FAIL:0 / PASS:13, gitleaks clean over alle feature-commits.
De gemockte suite staat op 64 skipped / 0 failed — de enige resterende verificaties
(e2e echt draaien, handmatige live-check quickstart §4) vereisen E2E-accounts die de
eigenaar (nog) niet beschikbaar heeft (zelfde gedocumenteerde staat als 010-012); geen
ervan blokkeert de frontend zelf. De develop-preview-test kon zonder die accounts
inhoudelijk niet meer omvatten dan de al-groene lokale gates. De release-PR bevat
naast 013 ook PR #26 (docs: 011 rollout-status) dat op develop klaarstond.

## Alternatives considered

- **Eerst op develop laten staan tot preview getest** — afgewezen: de preview-test kon
  inhoudelijk niet meer dan de al-groene lokale gates; er is geen breekraam te sluiten,
  maar op eigenaarsinstructie woog snelheid boven de releaseceremonie.
- **Direct op main committen** — afgewezen: verboden per AGENTS.md; gekozen voor de
  PR-route (feature-PR + release-PR), zodat de release traceerbaar en revertbaar blijft.

## Reasoning

Alle automatische gates groen; geen serveronderdelen of DB-wijzigingen die een
uitrolvolgorde dicteren; de constitution II-gap (ontbrekend CONCEPT-label in de chat) is
productierelevant en sluit met deze release. Zelfde patroon als
decisions/2026-10-20-012-directe-main-release.md, zelfde eigenaarsinstructie.

## Trade-offs accepted

- Geen Netlify-preview-verificatie op develop vóór productie.
- Productie-verificatie (quickstart §4) verschuift naar na-deploy, door Jaap.
- De e2e-suite draait pas echt zodra `E2E_EMAIL`/`E2E_PASSWORD` in `.env.local` staan.

## Supersedes

- `specs/013-readable-verifiable-answers/quickstart.md` §3 als uitgevoerde volgorde
  (stap 1-2 vervallen — er is niets server-side; stap 3 versneld). De quickstart blijft
  de richtlijn voor reguliere releases.