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