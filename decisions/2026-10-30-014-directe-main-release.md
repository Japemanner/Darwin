# Beslissing: 014-release direct naar main — develop-preview overgeslagen op eigenaarsinstructie

**Datum**: 2026-10-30 | **Feature**: 014-risk-analysis-page

## Decision

De release van 014 vond op één dag plaats: PR (feature → develop) en direct daarna de
develop → main release-PR, zonder de tussenliggende Netlify-preview-teststap op develop.
Expliciete instructie van de eigenaar ("merge naar main").

## Context

Frontend-only feature: geen migraties, Edge Functions of bucket-wijzigingen — er is geen
breekraam en geen releasevolgorde-afhankelijkheid (quickstart §4). Alle lokale gates
groen: tsc 0 fouten, eslint 0 errors (6 pre-existing baseline-warnings, geen nieuwe),
build groen (7,0 s), fitness FAIL:0 / PASS:13, gitleaks clean over alle feature-commits.
De volledige suite staat op 72 skipped / 0 failed — de resterende verificaties
(e2e echt draaien, handmatige live-check quickstart §3) vereisen E2E-accounts die de
eigenaar (nog) niet beschikbaar heeft (zelfde gedocumenteerde staat als 010-013).
De enige serverafhankelijkheid is het optionele lijstveld `expires_at` — het
frontend-schema is optioneel, dus de uitrolvolgorde is vrij en niets blokkeert.
De release-PR bevat naast 014 ook het terug-mergen van main in develop (historie-
synchronisatie na de 013-release-squash, zelfde patroon als bij 012/013).

## Alternatives considered

- **Eerst op develop laten staan tot preview getest** — afgewezen: de preview-test kon
  zonder E2E-accounts inhoudelijk niet meer dan de al-groene lokale gates; op
  eigenaarsinstructie woog snelheid boven de releaseceremonie.
- **Direct op main committen** — afgewezen: verboden per AGENTS.md; de PR-route
  (feature-PR + release-PR) houdt de release traceerbaar en revertbaar.

## Reasoning

Alle automatische gates groen; geen serveronderdelen of DB-wijzigingen die een
uitrolvolgorde dicteren; de feature lost het kernprobleem op (analyse overleeft
navigatie, klaar-meldingen overal). Zelfde patroon als
decisions/2026-10-20-012-directe-main-release.md en
decisions/2026-10-29-013-directe-main-release.md, zelfde eigenaarsinstructie.

## Trade-offs accepted

- Geen Netlify-preview-verificatie op develop vóór productie.
- Productie-verificatie (quickstart §3) verschuift naar na-deploy, door Jaap.
- De e2e-suite draait pas echt zodra `E2E_EMAIL`/`E2E_PASSWORD` in `.env.local` staan.
- Backend-afstemming `expires_at` op de echte recente-lijst-API volgt apart (vrijblijvend;
  zonder het veld toont de lijst alles behalve de vervaldatum).

## Supersedes

- `specs/014-risk-analysis-page/quickstart.md` §4 als uitgevoerde volgorde (stap 1 versneld;
  er is niets server-side). De quickstart blijft de richtlijn voor reguliere releases.