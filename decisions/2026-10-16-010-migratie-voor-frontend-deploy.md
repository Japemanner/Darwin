# Decision: migratie 015 toegepast vóór de frontend-deploy (010)

**Datum**: 2026-10-16

## Decision
Migratie `015_admin_only_writes.sql` is op 2026-10-16 door Jaap rechtstreeks op
productie toegepast, terwijl de UI-gating uit feature 010 nog niet op `main`
was gedeployd (PR #19 stond nog open). Daarmee is de verplichte
releasevolgorde uit `specs/010-admin-only-management/quickstart.md` §3
(frontend eerst, daarna migratie) bewust omgekeerd. Het gevolg is geaccepteerd;
de frontend-deploy is direct daarna als meest urgente stap uitgevoerd om het
risicovenster te sluiten.

## Context
De releasevolgorde in quickstart §3 is bewust "frontend eerst, daarna
migratie": in het venster daartussen is de UI al admin-only terwijl de
database het nog niet afdwingt (klein, onschadelijk venster — niemand ziet
fouten). Omgekeerd (zoals nu gebeurd) zien members op productie de oude
beheerknoppen wél en krijgen ze bij elke klik een RLS-foutmelding — precies
het scenario dat quickstart §3 als "onwenselijker" benoemt. De migratie was
al toegepast vóórdat de frontend-PR gemerged was.

## Alternatives considered
1. **Terugdraaien van de migratie (rollback quickstart §5) en de volgorde
   alsnog volgen** — verworpen: de migratie is correct en veilig; rollback
   zou het database-afdwinging-venster juist weer openen en dubbel werk
   betekenen.
2. **Migratie laten staan en frontend-deploy zoveel mogelijk versnellen**
   (dit PR-traject: werkboom afronden → PR #18/#19 → develop → main) —
   gekozen: sluit het zichtbare-fouten-venster het snelst.
3. **Wachten op volledige verificatie (rls-verify + e2e-regressie) vóór de
   frontend-deploy** — verworpen: dat houdt het venster juist langer open,
   en de verificatiemiddelen (E2E-credentials, geldige SUPABASE_ACCESS_TOKEN)
   waren niet beschikbaar.

## Reasoning
- De RLS-harding zelf is een verbetering van de beveiliging; elke minuut dat
  de oude frontend (zonder admin-gating) in productie draait, is het
  gebruikerservaringsrisico groter, niet kleiner.
- Het venster beïnvloedt alleen UX (zichtbare RLS-fouten voor members die op
  beheerknoppen klikken), geen data-integriteit.
- Merging van de frontend was het enige dat het venster sluit; alle lokale
  gates waren groen (tsc, build, fitness-check, gitleaks).

## Trade-offs accepted
- Members kunnen in het venster (tot de Netlify-deploy van `main` live is)
  op beheerknoppen klikken en een foutmelding zien.
- De §4 SQL-controles en `rls-verify.mjs` zijn nog niet gedraaid als bewijs
  dat de migratie correct is toegepast (SUPABASE_ACCESS_TOKEN verlopen;
  E2E_MEMBER_* niet gezet) — de correctheid rust nu op de review van
  `015_admin_only_writes.sql` en Jaaps toepassing daarvan.
- De e2e-regressiesuite draait nog niet echt (47 skipped zonder
  E2E-credentials).

## Supersedes
Geen — neemt geen eerder besluit in; documenteert een afwijking van
`specs/010-admin-only-management/quickstart.md` §3. Voor de volgende
database-hardening-release geldt: houd de volgorde aan (frontend eerst),
of accepteer expliciet het venster en deploy direct daarna.