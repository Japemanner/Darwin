# Beslissing: configuratie — deployment-breed in env, tenant/geheim in de UI

**Datum**: 2026-10-30 | **Feature**: cross-cutting (008, 009)

## Decision

Configuratie volgt één regel:

1. **Deployment-breed, niet geheim, hoort bij de build** → build-time
   environment variable (`.env.local` / Netlify), ingebakken door Vite.
   Voorbeelden: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
   `VITE_ANALYSIS_API_URL`, `VITE_PUBLIC_POSTHOG_*`.
2. **Tenant-specifiek of geheim** → database + admin-UI, alleen bereikbaar
   via een Edge Function met de service role. Voorbeeld: `flow_configs`
   (`webhook_url`, `webhook_auth_header`, `webhook_token`) per organisatie
   en per `flow_type`, beheerd in Instellingen.
3. **Secrets voor server-side gebruik** → Supabase Edge Function secrets
   (`ALLOWED_ORIGINS`, `RESEND_API_KEY`, service-role-key). Nooit in
   `.env.local` van de frontend, nooit in de bundel.

Een waarde mag dus alleen in een `VITE_`-variabele staan als hij (a) voor
alle tenants en gebruikers gelijk is, (b) geen geheim is en (c) per omgeving
mag verschillen. Anders is de UI/DB-route of de server-side secretroute
verplicht.

## Context

De vraag kwam op bij het instellen van de risico-analyse: waarom staat
`VITE_ANALYSIS_API_URL` in een env-bestand, terwijl de n8n-webhook in de
Instellingen-UI wordt ingevuld? De twee lijken op elkaar (beide een URL naar
een extern systeem) maar verschillen in scope, geheimhouding en wie ze mag
wijzigen:

| | `VITE_ANALYSIS_API_URL` | n8n-webhook (`flow_configs`) |
|---|---|---|
| Betekenis | welk Darwin-backend hoort bij deze build | welke n8n-workflow + token hoort bij deze tenant |
| Scope | één per deployment | per organisatie en per `flow_type` |
| Geheim | nee, publieke basis-URL | ja, `webhook_token` |
| Wijzigt door | wie deployt | admin van de tenant |
| Frequentie | bij een release | per klant / bij rotatie, zonder redeploy |

De analyse-URL is daarnaast een directe browser-aanroep (feature 008), terwijl
de n8n-koppeling sinds feature 009 achter Edge Functions zit. Dat verschil is
historisch gegroeid, niet als bewuste tegenstelling: 008 is vóór de
beveiligingsslag van 009 gebouwd.

## Alternatives considered

- **Alles in env** (ook de n8n-webhook): afgewezen — elke klant heeft een
  eigen n8n-instantie en token; dat zou een redeploy per tenant vergen, en een
  token in de bundel is precies het lek dat 009 heeft gedicht
  (`VITE_ENCRYPTION_KEY` stond in de publieke JS).
- **Alles in de UI/DB** (ook de analyse-URL): afgewezen — de URL is voor alle
  tenants gelijk en hoort bij de omgeving (lokale mock vs. productie). Een
  door een admin vrij invulbaar endpoint is een exfiltratievector: een
  gecompromitteerd adminaccount kan dan alle klantinhoud naar een eigen server
  laten sturen. Een env var is alleen door iemand met deploy-rechten te
  wijzigen.
- **Eén generieke `app_config`-tabel voor endpoints**: afgewezen — speculatieve
  configurabiliteit (constitution VI) en hetzelfde exfiltratierisico als de
  UI-variant, zonder dat er een tenantverschil is dat dit rechtvaardigt.

## Reasoning

De grens is niet "URL vs. token" maar "wie bepaalt de waarde en mag hem
wijzigen". Een admin van een tenant mag zijn eigen n8n-koppeling beheren, maar
mag niet bepalen naar welke backend de applicatie praat. En een geheim hoort
nooit in iets wat de browser ontvangt. De env-var-route geeft daarmee ook een
harde faalmodus: ontbreekt de waarde, dan stopt de client met een expliciete
melding in plaats van stil naar de verkeerde omgeving te praten.

## Trade-offs accepted

- De analyse-URL wijzigen vereist een redeploy; een admin kan dit niet zelf.
  Daarom is de foutmelding bij ontbreken expliciet ("De risico-analyse-
  voorziening is niet geconfigureerd").
- De constitutie noemde strikt "alleen `VITE_SUPABASE_URL` en
  `VITE_SUPABASE_ANON_KEY` in de bundel". Die regel is verbreed naar "alleen
  niet-geheime, deployment-brede waarden", met de PostHog- en analyse-URL als
  concrete uitzonderingen.
- De analyse-client blijft voorlopig een directe browser-aanroep met JWT, in
  afwijking van de Edge-Function-route van 009. Bij de echte backend geldt:
  publieke basis-URL mag env blijven; alles wat privileged is (n8n-token,
  service role) gaat server-side. Wordt het endpoint ooit tenant-specifiek,
  dan verhuist het naar `flow_configs`-achtige configuratie.

## Supersedes

Geen eerdere beslissing. Verduidelijkt de env-regel in
`.specify/memory/constitution.md` (Security & Data Protection Constraints) en
de security-regel in `AGENTS.md`.
