# Copy-inventaris — 017-dutch-ui-language

**Status**: **Goedgekeurd** — 2026-10-30, Jaap (akkoord via "ga door"). De drie openstaande
punten zijn ongewijzigd overgenomen: "Chat" blijft, technische notatie blijft, letterlijke
n8n-labels blijven.

**Opgesteld**: 2026-10-30

**Bron**: alle zichtbare en voorgelezen tekst in `src/` — JSX-tekst, knoppen, koppen,
placeholders, `aria-label`, `title`, toasts, dialoogtekst, lege toestanden, fout- en
statusmeldingen. Regels: `contracts/ui-copy.md`.

**Omvang**: 93 regels in 13 bestanden (1 nieuw bestand), 2 bestaande e2e-selectors
wijzigen, 1 nieuwe test.

> **Let op**: er is nog niets in `src/` of `tests/` gewijzigd. Pas na akkoord op deze
> tabel begint de implementatie.

## Wijzigingen

| # | bestand | scherm/onderdeel | oud | nieuw |
|---|---------|------------------|-----|-------|
| 1 | `src/lib/labels.ts` (nieuw) | rolweergave, alle schermen (opslagwaarden blijven `admin`/`member`) | — (bestaat nog niet; de UI toont de ruwe rolwaarde) | Beheerder, Adviseur, Geen rol |
| 2 | `src/components/layout/AppShell.tsx` | hoofdmenu · eerste item | Command Center | Overzicht |
| 3 | `src/components/layout/AppShell.tsx` | hoofdmenu · item | Roadmap | _(verwijderd uit het hoofdmenu)_ |
| 4 | `src/components/layout/AppShell.tsx` | gebruikersblok onderaan, desktop én mobiel | — (geen ingang in het gebruikersblok) | Ideeën en wensen → `/roadmap` |
| 5 | `src/components/layout/AppShell.tsx` | gebruikersblok · rol onder de naam | `{profile?.role}` (toont `admin` of `member`) | `{roleLabel(profile?.role)}` (Beheerder / Adviseur / Geen rol) |
| 6 | `src/pages/TeamPage.tsx` | rolkeuze bij uitnodigen | Lid | Adviseur |
| 7 | `src/pages/TeamPage.tsx` | rolkeuze bij uitnodigen | Admin | Beheerder |
| 8 | `src/pages/TeamPage.tsx` | ledenlijst · rolbadge | Lid | Adviseur |
| 9 | `src/pages/TeamPage.tsx` | ledenlijst · rolbadge | Admin | Beheerder |
| 10 | `src/pages/TeamPage.tsx` | openstaande uitnodigingen · rolbadge | Lid / Admin | Adviseur / Beheerder |
| 11 | `src/pages/TeamPage.tsx` | ledenkaart · titel | Leden ({n}) | Teamleden ({n}) |
| 12 | `src/pages/TeamPage.tsx` | lege toestand · actieknop | Nodig een lid uit | Nodig een teamlid uit |
| 13 | `src/pages/CommandCenterPage.tsx` | paginakop | Command Center — Welkom terug, {voornaam} | Overzicht — Welkom terug, {voornaam} |
| 14 | `src/pages/CommandCenterPage.tsx` | paginakop · ondertitel | Centraal overzicht van je omgeving | Centraal overzicht van uw omgeving |
| 15 | `src/pages/AssistantsPage.tsx` | paginakop | AI Assistenten | AI-assistenten |
| 16 | `src/pages/AssistantsPage.tsx` | paginakop · ondertitel (beheerder) | Beheer je AI assistenten en hun configuratie | Beheer uw AI-assistenten en hun configuratie |
| 17 | `src/pages/AssistantsPage.tsx` | lege toestand · beschrijving (beheerder) | Maak je eerste AI assistent aan om te beginnen met chatten | Maak uw eerste AI-assistent aan om te beginnen met chatten |
| 18 | `src/pages/AssistantsPage.tsx` | bevestigingsdialoog verwijderen | Weet je zeker dat je {naam} wilt verwijderen? Dit verwijdert ook alle gekoppelde conversaties en kennisbronkoppelingen. | Weet u zeker dat u {naam} wilt verwijderen? Dit verwijdert ook alle gekoppelde gesprekken en kennisbronkoppelingen. |
| 19 | `src/pages/AssistantsPage.tsx` | formulier · toelichting webhook-URL | Optioneel. Als ingevuld, gebruikt deze assistent zijn eigen webhook URL i.p.v. de gedeelde RAG-configuratie. | Optioneel. Als ingevuld, gebruikt deze assistent zijn eigen webhook-URL in plaats van de gedeelde configuratie. |
| 20 | `src/pages/KnowledgePage.tsx` | lege toestand · beschrijving (beheerder) | Upload documenten zodat uw assistenten er kennis uit kunnen putten | Voeg documenten toe zodat uw assistenten er kennis uit kunnen putten |
| 21 | `src/pages/KnowledgePage.tsx` | uploadstatus per bestand | Uploaden... | Toevoegen... |
| 22 | `src/pages/KnowledgePage.tsx` | toast bij mislukte upload | Upload mislukt | Toevoegen mislukt |
| 23 | `src/pages/KnowledgePage.tsx` | toast na upload | Document geüpload | Document toegevoegd |
| 24 | `src/pages/KnowledgePage.tsx` | documentenlijst · lege toestand | Nog geen documenten geüpload | Nog geen documenten toegevoegd |
| 25 | `src/pages/KnowledgePage.tsx` | kennisitem · placeholder inhoud | De tekst die naar de vector database gestuurd wordt... | De tekst die naar de kennisindex wordt gestuurd... |
| 26 | `src/pages/HistoryPage.tsx` | paginakop · ondertitel | Alle eerdere runs van je assistenten | Alle eerdere gesprekken van uw assistenten |
| 27 | `src/pages/HistoryPage.tsx` | lege toestand · titel | Nog geen runs | Nog geen gesprekken |
| 28 | `src/pages/HistoryPage.tsx` | lege toestand · beschrijving | Zodra je met een assistent chatten, verschijnen de runs hier | Zodra u met een assistent chat, verschijnen de gesprekken hier |
| 29 | `src/pages/HistoryPage.tsx` | gesprekspaneel · lege toestand | Geen berichten in deze run | Geen berichten in dit gesprek |
| 30 | `src/pages/RoadmapPage.tsx` | paginakop | Roadmap | Ideeën en wensen |
| 31 | `src/pages/RoadmapPage.tsx` | paginakop · ondertitel | Waar we aan werken en wat eraan komt — stem op features die jij belangrijk vindt | Waar we aan werken en wat eraan komt — stem op ideeën en wensen die u belangrijk vindt |
| 32 | `src/pages/RoadmapPage.tsx` | knop rechtsboven | Feature request | Idee of wens indienen |
| 33 | `src/pages/RoadmapPage.tsx` | lege toestand · titel | Nog geen features | Nog geen ideeën of wensen |
| 34 | `src/pages/RoadmapPage.tsx` | lege toestand · beschrijving | Er zijn nog geen roadmap-items in deze categorie | Er zijn nog geen ideeën of wensen in deze categorie |
| 35 | `src/pages/RoadmapPage.tsx` | toast na insturen · titel | Request verzonden | Verzoek verzonden |
| 36 | `src/pages/RoadmapPage.tsx` | toast na insturen · beschrijving | Je feature request is ingestuurd | Uw idee of wens is ingestuurd |
| 37 | `src/pages/RoadmapPage.tsx` | dialoog · titel | Feature request indienen | Idee of wens indienen |
| 38 | `src/pages/RoadmapPage.tsx` | dialoog · uitleg | Heb je een idee voor een nieuwe feature? Laat het weten — je request wordt direct naar Jaap gestuurd. | Hebt u een idee of wens? Laat het weten — uw verzoek wordt direct naar Jaap gestuurd. |
| 39 | `src/pages/RoadmapPage.tsx` | dialoog · placeholder titel | Korte titel van je idee | Korte titel van uw idee |
| 40 | `src/pages/RoadmapPage.tsx` | dialoog · placeholder beschrijving | Beschrijf wat de feature moet doen | Beschrijf wat het idee of de wens inhoudt |
| 41 | `src/pages/RoadmapPage.tsx` | dialoog · label motivatie | Waarom heb je dit nodig? | Waarom heeft u dit nodig? |
| 42 | `src/components/auth/LoginPage.tsx` | login · ondertitel | Log in met je e-mailadres en wachtwoord | Log in met uw e-mailadres en wachtwoord |
| 43 | `src/components/auth/LoginPage.tsx` | login · foutmelding | `error.message` (Engels, bijv. "Invalid login credentials") | Inloggen mislukt. Controleer uw e-mailadres en wachtwoord. |
| 44 | `src/pages/ForgotPasswordPage.tsx` | toast na versturen · beschrijving | Controleer je inbox voor de reset-link. Ook in je spamfolder kijken. | Controleer uw inbox voor de herstelkoppeling. Kijk ook in uw spamfolder. |
| 45 | `src/pages/ForgotPasswordPage.tsx` | paginaondertitel | Vul je e-mailadres in en we sturen je een link om je wachtwoord te resetten. | Vul uw e-mailadres in; wij sturen u een koppeling om uw wachtwoord opnieuw in te stellen. |
| 46 | `src/pages/ForgotPasswordPage.tsx` | knop | Stuur reset-link | Stuur herstelkoppeling |
| 47 | `src/pages/ForgotPasswordPage.tsx` | fout-toast · beschrijving | `err.message` (kan Engels zijn) | Versturen mislukt. Probeer het opnieuw. |
| 48 | `src/pages/ResetPasswordPage.tsx` | verlopen koppeling · titel | Link verlopen | Koppeling verlopen |
| 49 | `src/pages/ResetPasswordPage.tsx` | verlopen koppeling · beschrijving | Deze reset-link is verlopen of ongeldig. Vraag een nieuwe aan. | Deze herstelkoppeling is verlopen of ongeldig. Vraag een nieuwe aan. |
| 50 | `src/pages/ResetPasswordPage.tsx` | verlopen koppeling · knop | Nieuwe reset-link aanvragen | Nieuwe herstelkoppeling aanvragen |
| 51 | `src/pages/ResetPasswordPage.tsx` | nieuw wachtwoord · ondertitel | Kies een nieuw wachtwoord voor je account. | Kies een nieuw wachtwoord voor uw account. |
| 52 | `src/pages/ResetPasswordPage.tsx` | nieuw wachtwoord · placeholder | Herhaal je wachtwoord | Herhaal uw wachtwoord |
| 53 | `src/pages/ResetPasswordPage.tsx` | toast wachtwoord te kort · beschrijving | Je wachtwoord moet minimaal 8 tekens bevatten. | Uw wachtwoord moet minimaal 8 tekens bevatten. |
| 54 | `src/pages/ResetPasswordPage.tsx` | toast na opslaan · beschrijving | Je kunt nu inloggen met je nieuwe wachtwoord. | U kunt nu inloggen met uw nieuwe wachtwoord. |
| 55 | `src/pages/ResetPasswordPage.tsx` | fout-toast · beschrijving | `err.message` (kan Engels zijn) | Aanpassen mislukt. Probeer het opnieuw. |
| 56 | `src/pages/ResetPasswordPage.tsx` | time-outmelding | Aanvraag duurt te lang, probeer opnieuw | De aanvraag duurt te lang. Probeer het opnieuw. |
| 57 | `src/components/auth/ProtectedRoute.tsx` | sessie verlopen · beschrijving | Je sessie is verlopen. Log opnieuw in. | Uw sessie is verlopen. Log opnieuw in. |
| 58 | `src/components/analysis/RecentRunsPanel.tsx` | paneel · aria-label | Recente runs | Recente uitvoeringen |
| 59 | `src/components/analysis/RecentRunsPanel.tsx` | paneel · kop | Recente runs | Recente uitvoeringen |
| 60 | `src/components/analysis/RecentRunsPanel.tsx` | paneel · foutmelding | Recente runs konden niet worden opgehaald. Controleer de verbinding. | Recente uitvoeringen konden niet worden opgehaald. Controleer de verbinding. |
| 61 | `src/components/analysis/RecentRunsPanel.tsx` | paneel · lege toestand | Nog geen runs gestart. | Nog geen uitvoeringen gestart. |
| 62 | `src/components/analysis/ResultView.tsx` | ongeldig resultaat · beschrijving | … of start een nieuwe run. | … of start een nieuwe uitvoering. |
| 63 | `src/components/analysis/ResultView.tsx` | resultaat verwijderd · beschrijving | Alleen de run-metadata is nog beschikbaar. | Alleen de gegevens van de uitvoering zijn nog beschikbaar. |
| 64 | `src/components/analysis/ResultView.tsx` | bewaartermijn · hint | Bewaartermijn: download vóór {datum} | Bewaartermijn: sla het dossier op vóór {datum} |
| 65 | `src/components/analysis/ResultView.tsx` | dossierknop | Download dossier (.docx) — CONCEPT, door adviseur te accorderen | Dossier opslaan (.docx) — CONCEPT, door adviseur te accorderen |
| 66 | `src/components/analysis/ResultView.tsx` | dossierknop (niet beschikbaar) | Download dossier (.docx) niet beschikbaar | Dossier opslaan (.docx) niet beschikbaar |
| 67 | `src/lib/analysis-client.ts` | fout bij ophalen | De run is niet gevonden. | De uitvoering is niet gevonden. |
| 68 | `src/lib/analysis-client.ts` | fout bij status | De runstatus kon niet worden uitgelezen (ongeldig antwoord). | De status van de uitvoering kon niet worden uitgelezen (ongeldig antwoord). |
| 69 | `src/lib/analysis-client.ts` | fout bij recente lijst | De lijst recente runs kon niet worden uitgelezen. | De lijst met recente uitvoeringen kon niet worden uitgelezen. |
| 70 | `src/lib/analysis-client.ts` | fout zonder configuratie | De risico-analyse API is niet geconfigureerd. | De risico-analysevoorziening is niet geconfigureerd. |
| 71 | `src/lib/rag-client.ts` | fout bij time-out | De assistant reageert niet binnen de toegestane tijd. Probeer het opnieuw. | De assistent reageert niet binnen de toegestane tijd. Probeer het opnieuw. |
| 72 | `src/pages/SettingsPage.tsx` | rolkeuze nieuwe organisatie | Admin | Beheerder |
| 73 | `src/pages/SettingsPage.tsx` | rolkeuze nieuwe organisatie | Lid | Adviseur |
| 74 | `src/pages/SettingsPage.tsx` | toast na aanmaken | {organisatie} is succesvol aangemaakt met admin {e-mail} | {organisatie} is succesvol aangemaakt met beheerder {e-mail} |
| 75 | `src/pages/SettingsPage.tsx` | kaart nieuwe organisatie · titel | Nieuwe Organisatie &amp; Gebruiker | Nieuwe organisatie en gebruiker |
| 76 | `src/pages/SettingsPage.tsx` | kaart nieuwe organisatie · beschrijving | Maak een nieuwe tenant (organisatie) aan met een admin-gebruiker. De gebruiker kan direct inloggen met het opgegeven wachtwoord. | Maak een nieuwe organisatie aan met een beheerdersaccount. De gebruiker kan direct inloggen met het opgegeven wachtwoord. |
| 77 | `src/pages/SettingsPage.tsx` | tab | Nieuwe Organisatie | Nieuwe organisatie |
| 78 | `src/pages/SettingsPage.tsx` | kaart chatconfiguratie · titel | Chat assistent Configuratie | Chatassistent-configuratie |
| 79 | `src/pages/SettingsPage.tsx` | kaart chatconfiguratie · beschrijving | Configureer de gedeelde n8n webhook voor alle chat assistants. Deze instelling geldt voor alle assistants van type "chat". | Configureer de gedeelde n8n-webhook voor alle chatassistenten. Deze instelling geldt voor alle assistenten van het type "chat". |
| 80 | `src/pages/SettingsPage.tsx` | kaart documentverwerking · titel | Kennisbron Documentverwerking Configuratie | Configuratie kennisbron-documentverwerking |
| 81 | `src/pages/SettingsPage.tsx` | kaart documentverwerking · beschrijving | Configureer de n8n webhook voor documentverwerking. Bij elke document-upload maakt de server de signed download URL en stuurt deze naar de webhook. | Configureer de n8n-webhook voor documentverwerking. Bij elke documentaanlevering maakt de server de ondertekende ophaal-URL en stuurt die naar de webhook. |
| 82 | `src/pages/SettingsPage.tsx` | formulier · label | Auth Header Naam | Naam autorisatieheader |
| 83 | `src/pages/SettingsPage.tsx` | formulier · toelichting header | De HTTP-header naam die n8n verwacht. Standaard: `X-Webhook-Token`. Dit moet overeenkomen met de Header Auth instelling in je n8n Webhook node. | De naam van de HTTP-header die n8n verwacht. Standaard: `X-Webhook-Token`. Dit moet overeenkomen met de instelling Header Auth in uw n8n Webhook node. |
| 84 | `src/pages/SettingsPage.tsx` | formulier · placeholder token | De Header Value uit je n8n Webhook node | De Header Value uit uw n8n Webhook node |
| 85 | `src/pages/SettingsPage.tsx` | formulier · toelichting token (ingesteld) | Dit is de Header Value uit je n8n Webhook node (Header Auth). De token wordt server-side opgeslagen en is na het opslaan niet meer uit te lezen. Laat leeg om de bestaande token te behouden. | Dit is de Header Value uit uw n8n Webhook node (Header Auth). De token wordt aan de serverkant opgeslagen en is na het opslaan niet meer uit te lezen. Laat leeg om de bestaande token te behouden. |
| 86 | `src/pages/SettingsPage.tsx` | formulier · toelichting token (leeg) | Voer de Header Value in uit je n8n Webhook node (Header Auth). De token wordt server-side opgeslagen en is na het opslaan niet meer uit te lezen. | Voer de Header Value in uit uw n8n Webhook node (Header Auth). De token wordt aan de serverkant opgeslagen en is na het opslaan niet meer uit te lezen. |
| 87 | `src/pages/SettingsPage.tsx` | toast zonder URL | Voer eerst een webhook URL in | Voer eerst een webhook-URL in |
| 88 | `src/pages/SettingsPage.tsx` | handleiding · titel | n8n Webhook Configuratie Handleiding | Handleiding n8n-webhookconfiguratie |
| 89 | `src/pages/SettingsPage.tsx` | handleiding · stap 4 · titel | 4. Workflow activeren | 4. Werkstroom activeren |
| 90 | `src/pages/SettingsPage.tsx` | handleiding · stap 4 · tekst | Zorg dat de n8n workflow op **Active** staat, anders is de webhook URL niet bereikbaar. | Zorg dat de n8n-werkstroom op **Active** staat, anders is de webhook-URL niet bereikbaar. |
| 91 | `src/pages/SettingsPage.tsx` | handleiding · stap 5 · tekst | Maak een aparte n8n workflow voor documentverwerking. Deze webhook ontvangt bij elke upload een payload met `tenantId`, `knowledgeSourceName`, `document_name`, `document_type` en `download_url`. De download URL is 15 minuten geldig. | Maak een aparte n8n-werkstroom voor documentverwerking. Deze webhook ontvangt bij elke aanlevering een bericht met `tenantId`, `knowledgeSourceName`, `document_name`, `document_type` en `download_url`. De ophaal-URL is 15 minuten geldig. |
| 92 | `src/pages/SettingsPage.tsx` | resultaatblok na aanmaken | Org ID: {id} | Organisatiecode: {id} |
| 93 | `src/pages/SettingsPage.tsx` | resultaatblok na aanmaken | Gebruiker: {e-mail} (ID: {id}) | Gebruiker: {e-mail} (code: {id}) |

## Bewust ongewijzigd (gecontroleerd)

Deze bestanden zijn volledig gelezen en bevatten alleen Nederlandse tekst in de u-vorm,
alleen toegestane termen, of geen gebruikersgerichte tekst:

| Bestand | Reden |
|---------|-------|
| `src/App.tsx` | alleen routes; geen UI-tekst |
| `src/components/chat/AnswerFeedback.tsx` | "Wat ging er mis?", "Toelichting (optioneel)", "Antwoord is nuttig", "Versturen" — Nederlands |
| `src/components/chat/AnswerMeta.tsx` | CONCEPT-label en verificatietekst blijven verplicht ongewijzigd (constitution II) |
| `src/components/chat/ChatComposer.tsx` | "Typ uw bericht…", "Bericht", "Versturen" — al u-vorm |
| `src/components/chat/ChatEmptyState.tsx` | "Stel uw vraag om het gesprek te starten met {naam}." — al u-vorm |
| `src/components/chat/ChatHeader.tsx` | "Terug naar assistenten", "Nieuw gesprek" |
| `src/components/chat/MessageBubble.tsx` | "Opnieuw proberen", "Kopiëren" |
| `src/components/chat/MessageContent.tsx` | geen UI-tekst |
| `src/components/chat/MessageList.tsx` | "Antwoord wordt opgesteld…", "Dit duurt langer dan gebruikelijk." |
| `src/components/analysis/AnalysisForm.tsx` | labels en placeholders zijn Nederlands; "pdf, docx, txt" zijn bestandstypen |
| `src/components/analysis/AnalysisMarkdown.tsx` | geen UI-tekst |
| `src/components/analysis/GapsPanel.tsx` | "Ontbrekende informatie voor het gesprek" |
| `src/components/analysis/RunCard.tsx` | statuswoorden (in wachtrij, bezig, klaar, mislukt) blijven (afgestemd met bestaande tests) |
| `src/components/analysis/SourcePanel.tsx` | "Bronverwijzing", "Referentie", "Document", "Locatie", "Letterlijke passage" |
| `src/pages/AnalysisNewPage.tsx` | pagina- en foutteksten zijn al Nederlands en in de u-vorm |
| `src/pages/AnalysisRunPage.tsx` | idem; foutmelding komt uit `analysis-client` (regels 67–70) |
| `src/pages/ChatPage.tsx` | "Gesprek niet gevonden", "Kopiëren is mislukt" — al Nederlands |
| `src/lib/storage.ts` | foutteksten al Nederlands en in de u-vorm |
| `src/lib/flow-config-client.ts` | idem |
| `src/components/ui/toast.tsx` | aria-label "Melding sluiten" is al Nederlands |
| `index.html`, `public/handleiding.html` | buiten scope (handleiding) respectievelijk geen UI-tekst |

Binnen gewijzigde bestanden blijven deze teksten bewust staan:

- `AppShell`: "Darwin", de menu-items Assistenten/Kennisbronnen/Geschiedenis/Team/Instellingen,
  "analyses klaar of mislukt sinds uw laatste bezoek:", "Gebruiker", "Onbekende gebruiker",
  "Geen rol".
- `AssistantsPage`: "N8N Webhook URL" (alleen toegestane termen; bestaande tests selecteren
  op dit label), "Chat" (zie openstaand punt 1), "Risico-analyse", "Inactief",
  "Actief", "Nieuwe assistent", "Assistent bewerken" en de overige formulierlabels.
- `KnowledgePage`: "Documenten", "Gekoppeld", "Bestanden toevoegen", "of sleep bestanden
  hierheen · PDF, TXT, DOCX" (bestandstypen), "Opnieuw verwerken", "Verwerken...",
  "Klaar", "Fout", "Bezig...", "Laden...".
- `SettingsPage`: "Webhooks", "Webhook URL", "Webhook Token", "Testen...",
  "Verbinding testen", "Bijwerken", "Configuratie aanmaken", en de letterlijke
  n8n-labels in de handleiding (`Webhook node`, `Production URL`, `Test URL`,
  `Settings`, `Authentication`, `Header auth`, `Header Name`, `Header Value`,
  `Active`, `Enabled`, `Allow Origin`).
- `RoadmapPage`: statuslabels (In overweging, Gepland, In ontwikkeling, Verzonden),
  "Stem omhoog"/"Stem omlaag", "Verzenden", "Titel", "Beschrijving".
- `ResultView`: "CONCEPT, door adviseur te accorderen", "Interne analyse",
  "Intern, speculatief", "Kopieer interne tekst", foutcode `INVALID_RESULT_SCHEMA`.

## Openstaande punten voor akkoord

1. **"Chat"** — de knop op de assistentkaart, de assistenttype-badge en het tabblad
   "Chat" op de analysepagina. Voorstel: behouden als ingeburgerd Nederlands leenwoord
   (net als "team" en "e-mail"). Alternatief: knop → "Gesprek starten" en type →
   "Chat"; dan wijzigt ook één bestaande selector
   (`getByRole('button', { name: /^chat$/i })`).
2. **Technische notatie** — `HTTP`, `HTTPS`, `TXT` en de bestandsextensies `pdf`, `docx`,
   `txt` blijven staan als notatie (geen Engels proza). Alternatief: voluit schrijven,
   wat de handleiding onleesbaar maakt.
3. **Letterlijke n8n-labels** — `Webhook node`, `Production URL`, `Test URL`,
   `Settings`, `Authentication`, `Header auth`, `Header Name`, `Header Value`, `Active`,
   `Enabled`, `Allow Origin` blijven staan zodat de gebruiker ze in n8n terugvindt
   (zoals al in de aannames van de spec staat).

## Gevolg voor de tests

| Spec | Regel | Wijziging |
|------|-------|-----------|
| `tests/e2e/document-webhook.spec.ts` | 70 | `'Document geüpload'` → `'Document toegevoegd'` (regel 23) |
| `tests/e2e/document-webhook.spec.ts` | 89 | `'Upload mislukt'` → `'Toevoegen mislukt'` (regel 22) |
| `tests/e2e/admin-only-management.spec.ts` | — | één assertie toevoegen: beheerdersblok toont `Beheerder` |
| `tests/e2e/sidebar-navigation.spec.ts` | nieuw | één test: `Adviseur` in het gebruikersblok, geen `Roadmap` in het hoofdmenu, `Ideeën en wensen` in het gebruikersblok en werkend naar `/roadmap` |

Geen enkele andere bestaande selector raakt gewijzigde tekst: `Nog geen documenten` blijft als
substring matchen, `Webhook URL` en `Webhook Token` blijven staan, statuswoorden blijven
staan, en `fixtures.ts` controleert alleen het URL-pad.

## Akkoord nodig

- **Akkoord**: antwoord met "akkoord" (of "akkoord, met uitzondering van regel N").
- **Aanpassing**: noem de regelnummers en de gewenste tekst; ik werk eerst deze tabel bij
  en vraag daarna opnieuw akkoord.
- Pas daarna worden de teksten per bestand aangepast, de label-map toegevoegd, de
  menupositie gewijzigd en de tests bijgewerkt.
