# Beslissing: 012-release direct naar main — develop-preview overgeslagen op eigenaarsinstructie

**Datum**: 2026-10-20 | **Feature**: 012-per-answer-feedback

## Decision

De release van 012 vond op één dag plaats: PR #24 (feature → develop) en direct daarna de
develop → main release-PR, zonder de tussenliggende Netlify-preview-teststap op develop.
Expliciete instructie van de eigenaar ("push naar main en trigger een redeploy"), mede
ingegeven door het openstaande breekraam: sinds de migratie (017, toegepast 2026-10-20 via
de Supabase-webUI) kon de oude productiebalk geen nieuwe gespreksfeedback meer opslaan —
elke dag vertraging verlengde dat raam.

## Context

De branching strategy schrijft develop-preview vóór main voor. De preview-test kon zonder
E2E-accounts (eigenaar bevestigd 2026-10-20: geen testaccount beschikbaar) niet meer
omvatten dan de lokale gates — die waren al groen (tsc 0 fouten, eslint 0 fouten,
build groen, gemockte suite 51 skipped/0 failed). Pre-landing review was uitgevoerd.
011 stond al op main (PR #23); content-diff main ↔ develop was leeg, zodat de
release-PR-diff exact de 012-wijzigingen was. 011's databaseprerequisite
(`example_questions`, migratie 016) was op productie geverifieerd.

## Alternatives considered

- **Eerst op develop laten staan tot preview getest** — afgewezen: het breekraam bleef
  open en de preview-test kon inhoudelijk niet meer dan de al-groene lokale gates.
- **Direct op main committen** — afgewezen: verboden per AGENTS.md; gekozen voor de
  PR-route (PR #24 + release-PR), zodat de release traceerbaar en revertbaar blijft.

## Reasoning

Alle automatische gates waren groen, de pre-landing review had geen open ASK-items, en
de enige resterende verificaties (real-DB e2e, `get_feedback_review()`-admin/lid-check,
fitness F-01/F-10/F-16/F-17) vereisen een testaccount dan wel een MCP-sessie — geen van
alle blokkeert de frontend zelf. Het sluiten van het breekraam woog zwaarder dan de
releaseceremonie. Lijn met decisions/2026-10-14-secure-n8n-proxy.md (zelfde afweging bij
009, zelfde eigenaarsinstructie).

## Trade-offs accepted

- Geen Netlify-preview-verificatie op develop vóór productie.
- Productie-verificatie (quickstart §4, canary-achtig) verschuift naar na-deploy.

## Supersedes

- `specs/012-per-answer-feedback/quickstart.md` §3 als uitgevoerde volgorde (stap 1-2
  gebeurden via de Supabase-webUI i.p.v. MCP; stap 3 versnelde). De quickstart blijft de
  richtlijn voor reguliere releases.