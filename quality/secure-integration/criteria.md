# Quality criteria — secure integration (Edge Functions / webhooks)

Wat "goed" is voor beveiligde koppelingen in Darwin (onlleend aan constitution,
AGENTS.md en de 009-rollout):

1. **Geen geheim in de client-bundel**: geen encryptiesleutels, geen
   encryptie-/decryptielogica, geen tokens (SC-001, afgedwongen door F-18).
2. **Tenant-beslissingen uitsluitend server-side**: 401 zonder geldige sessie,
   403 bij cross-tenant (assistent/gesprek/document van een andere organisatie).
3. **Geheimen afgeschermd voor client-rollen**: kolom-grants of RLS; write-only
   waar lezen niet nodig is; verifieerbaar via REST met anon- én
   authenticated-rollen.
4. **Nederlandse foutmeldingen met foutcode voor élk scenario**
   (constitution V): geen configuratie, onbereikbaar, auth-fout, time-out,
   serverfout, ongeldig antwoord; geen stille fouten.
5. **Geen berichtinhoud of tokens in logs** (constitution III): alleen codes,
   id's en duur.
6. **SSRF-guard op uitgaande webhook-URL's**: https-only, geen letterlijk IP /
   localhost / link-local; het opgeslagen token gaat nooit naar een afwijkende
   URL.
7. **CORS fail-closed**: origin-whitelist via secret, geen wildcard op
   functies die berichtinhoud verwerken.
8. **Rollout volgens de gedocumenteerde releasevolgorde**; migraties op het
   productieproject nooit zonder expliciete bevestiging.
9. **Geen nieuwe runtime-dependencies** zonder noodzaak.
10. **Documentatie actueel**: spec/plan/contracts/quickstart/FEATURES na
    afronding bijgewerkt en gecommit.

## Evaluatie — 009-secure-n8n-proxy (2026-10-14)

```
## Output: Beveiligde n8n-koppeling via de server — 3 Edge Functions
   (rag-chat, document-webhook, flow-config), migratie 014
   (wipe + REVOKE/GRANT + WITH CHECK), client-cleanup (webhook.ts weg,
   VITE_ENCRYPTION_KEY weg), fitness-check F-18; gerold naar productie
   en live geverifieerd.
## Criteria checked:
  1. PASS — bundel: oude sleutelwaarde 0 treffers; geen
     crypto.subtle encrypt/decrypt (F-18 groen in de pre-commit hook)
  2. PASS — curl: 401 zonder JWT; 403 FORBIDDEN met NL-melding bij een
     assistent-id buiten de eigen organisatie
  3. PASS — REST: anon volledig geweigerd (42501); authenticated:
     token-kolom 42501, veilige kolommen 200
  4. PASS — foutmatrix geïmplementeerd en live waargenomen (NL-meldingen in
     de UI); e2e-tests geschreven (4 nieuwe specs), gedraaid zonder
     E2E-credentials als skip
  5. PASS — functies loggen uitsluitend code/id's/duur (contracten + review)
  6. PASS — https + geen-IP-guard in alle drie de functies, inclusief
     fallback-URL's; test-tokenregel blokkeert exfiltratie naar afwijkende URL
  7. PASS — ALLOWED_ORIGINS fail-closed; live geverifieerd: exacte origin in
     de ACAO-header, match ontbrak eerst en werd gerepareerd
  8. PASS — releasevolgorde aangehouden: functions → main (PR #17) →
     migratie 014 → token-invoer per organisatie; wipe vóór invoer
  9. PASS — geen nieuwe dependencies
  10. PASS — spec/plan/contracts/quickstart/FEATURES/F-18 bijgewerkt;
      kennis, beslissingen en criteria vastgelegd (deze map)
## Score: 10/10
## Gaps: e2e-suite wacht op E2E_EMAIL/E2E_PASSWORD; Snyk (F-16/17) en
   RLS/bucket-verificatie (F-01/10) wachten op actieve MCP's;
   SUPABASE_ACCESS_TOKEN in .env.local is verlopen.
## Verdict: SHIP
```

## Her-verificatie tegen de technische route (2026-10-14, tweede sessie)

```
## Output: Route-vs-code verificatie van de gemergde feature (PR #16);
   alle routepunten aanwezig: 3 Edge Functions (auth-patroon, RLS-gebruikersclient,
   service-role flow_configs-lees, knowledge_sources + legacy, 60s/10s time-outs,
   foutcodes { code, message }, log code/id's/duur, fail-closed CORS), migratie 014
   (wipe + REVOKE/GRANT exact de 7 routekolommen + WITH CHECK), rag-client.ts,
   storage.ts (delete meldt eerst), SettingsPage write-only token, analysis-client
   JWT op 3 calls, F-18, quickstart met rolloutvolgorde en curl 401/403/200.
## Criteria checked:
  1. PASS — dist/ schoon: 0 treffers VITE_ENCRYPTION_KEY en
     crypto.subtle.(decrypt|encrypt); F-18 groen
  2. PASS — 401/403-paden code-geverifieerd (user-context client + org-checks);
     live curl eerder gedaan (evaluatie hierboven)
  3. PASS — migratie 014 kolom-grants exact volgens route; geen enkele
     flow_configs-lees meer in src/ (verdergaand dan de route)
  4. PARTIAL — foutmatrix volledig in code en specs; Playwright 23/23 skip
     zonder E2E-credentials (0 failed, infrastructuur werkt)
  5. PASS — alle drie de functies loggen uitsluitend code/id's/duur
  6. PASS — SSRF-guards in alle drie de functies + token-exfiltratie-regel
     in flow-config 'test'
  7. PASS — ALLOWED_ORIGINS fail-closed in alle drie de functies, nooit '*'
  8. PASS — releasevolgorde gedocumenteerd in quickstart en uitgevoerd
     (beslissingen-bestand)
  9. PASS — geen nieuwe dependencies
  10. PASS — spec/plan/contracts/quickstart/FEATURES gecommit;
       kennis/kwaliteit/beslissingen staged op docs/009-lessons-learned
## Score: 9/10
## Gaps: eslint --max-warnings 0 faalt op de boom met 6 PRE-EXISTING warnings
   (App.tsx, toast.tsx, posthog.tsx — geen daarvan van feature 009; de
   pre-commit hook is in de praktijk niet-blokkerend voor ESLint, tegen
   AGENTS.md in); scripts/fitness-check.sh is met core.autocrlf=true niet
   draaibaar onder WSL-bash zonder LF-conversie (zie
   knowledge/tooling/knowledge.md); e2e blijft credentials nodig hebben;
   F-01/10/16/17 wachten op actieve MCP's.
## Verdict: SHIP (feature conform route; gaps zijn geen 009-regressies)
```