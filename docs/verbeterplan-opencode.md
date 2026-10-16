# Darwin verbeterplan: prompts voor OpenCode + Spec Kit

Opgesteld 12-10-2026 op basis van de review van 10-10-2026 (code, specs en de n8n-flows `Agentic RAG Query 1.5` en `Agentic_RAG_Search 1.5`).

Elke groep is één Spec Kit-feature met twee prompts: één voor `/speckit.specify` (wat en waarom) en één voor `/speckit.plan` (technische route met bestandsnamen). De specify-prompt houdt de spec functioneel; de plan-prompt voorkomt dat het model zelf een architectuur verzint. De prompts zijn bewust expliciet over bestanden, grenzen en "buiten scope", zodat ook een kleiner model niet gaat uitwaaieren.

---

## 0. Werkwijze per groep

Voorwaarde: `008-risico-analyse-ui` staat gemerged op `develop`.

1. Voorbereiden (vaste prompt, zie onder)
2. `/speckit.specify` + prompt 1 van de groep
3. `/speckit.clarify` (beantwoord de vragen; kies bij twijfel de kleinste optie die alle acceptatiecriteria haalt)
4. `/speckit.plan` + prompt 2 van de groep
5. `/speckit.tasks`
6. `/speckit.analyze` (ga pas door als er geen CRITICAL of HIGH meer openstaat)
7. Implementeren (vaste prompt)
8. Afronden (vaste prompt)

Vaste prompt Voorbereiden:

```text
Bereid een nieuwe Spec Kit-feature voor. Voer uit: git checkout develop, daarna git pull origin develop, daarna git status. Is de werkboom niet schoon, stop dan en meld welke bestanden afwijken. Doe verder niets en maak nog geen branch aan; dat doet /speckit.specify.
```

Vaste prompt Implementeren:

```text
/speckit.implement Werk fase voor fase volgens tasks.md. Draai na elke fase npx tsc --noEmit en npx eslint src/ --max-warnings 0 en los fouten op voordat je verdergaat. Commit per afgeronde user story met een Engelse conventional commit. Raak geen bestanden aan buiten de taken. Pas geen migraties toe op Supabase en deploy geen Edge Functions zonder mijn expliciete bevestiging in de chat: er is één Supabase-project en dat is productie. Meld eerst wat je wilt toepassen. Stop en vraag bij een onduidelijk contract of een conflict met .specify/memory/constitution.md. Zet handmatige stappen uit quickstart.md in je eindoverzicht in plaats van ze zelf uit te voeren.
```

Vaste prompt Afronden:

```text
Rond deze feature af volgens AGENTS.md, sectie "After Every Feature": werk FEATURES.md bij via @feature-tracker, draai de volledige Playwright-suite, draai @fitness-checker en werk FITNESS.md bij. Is alles groen, push dan de branch en open via de GitHub MCP een pull request naar develop met per user story een korte samenvatting, de testresultaten en de handmatige stappen uit quickstart.md. Merge niet zelf. Is iets rood, stop en meld wat er faalt.
```

Merge de PR van een groep naar `develop` voordat je aan de volgende groep begint.

Groep N (n8n) gaat niet via OpenCode, want OpenCode heeft geen n8n-MCP. Die staat onderaan.

## Overzicht en volgorde

| Groep | Inhoud | Hangt af van | Omvang |
|---|---|---|---|
| A | Beveiligde koppeling via Edge Functions | – | L |
| B | Rollen: beheer alleen voor beheerders | A | M |
| C | Toegankelijke dialogen en zijpanelen | – | S |
| D | Chat als eigen pagina | A, B | L |
| E | Feedback per antwoord en meetgegevens | D | M |
| F | Antwoordweergave en vertrouwen | C, E | M |
| G | Risico-analyse als eigen pagina | B, C | M |
| H | Startscherm en Geschiedenis | D, G | M |
| I | Kennisbronnenbeheer | A, B, C | M |
| J | Taal en navigatie | alle vorige | S |

C kan eventueel parallel aan A. Alle andere groepen na elkaar.

---

## A. Beveiligde koppeling via Edge Functions

Waarom eerst: de sleutel `VITE_ENCRYPTION_KEY` zit in de JS-bundle, het webhook-token gaat vanuit de browser mee en n8n vertrouwt `tenantId` uit de body. Elke ingelogde gebruiker kan zo documenten van een andere organisatie bevragen. Al het latere chatwerk bouwt op deze serverroute.

### A1 · /speckit.specify

```text
Beveiligde koppeling tussen Darwin en n8n via de server.

Huidige situatie:
- De browser roept de n8n-webhooks rechtstreeks aan (src/lib/webhook.ts: callRagWebhook, callDocumentWebhook, testWebhook).
- Het webhook-token staat versleuteld in flow_configs, maar de sleutel (VITE_ENCRYPTION_KEY) zit in de publieke JS-bundle. Elke ingelogde gebruiker kan het token dus lezen.
- De browser bepaalt zelf tenantId (organisatienaam), kennisbronnen en system prompt in de payload, en n8n vertrouwt die waarden. Een gebruiker van organisatie A kan daardoor documenten van organisatie B bevragen.
- Een assistent met meerdere kennisbronnen stuurt de namen samengevoegd als één string ("Schade, Acceptatie"); de zoekstap vindt dan niets.
- De analyse-client (src/lib/analysis-client.ts) stuurt geen JWT mee, terwijl de contracten in specs/008-risico-analyse-ui/contracts/ dat eisen.

Doel: geen geheim en geen tenant-beslissing meer in de browser.

User stories:
1. (P1) Als adviseur stel ik een vraag aan een chat-assistent. De server controleert wie ik ben, bepaalt mijn organisatie en de kennisbronnen van de assistent en haalt het antwoord op bij n8n. Ik merk geen verschil, behalve duidelijkere foutmeldingen.
2. (P1) Als beheerder upload of verwijder ik een document. De server meldt dit aan n8n, met een downloadlink die de server zelf maakt.
3. (P1) Als beheerder stel ik in Instellingen de webhook-URL, de headernaam en het token in en test ik de verbinding. Het token kan ik daarna niet meer uitlezen, alleen vervangen.
4. (P2) De risico-analyse-client stuurt bij elke aanroep het sessie-JWT mee.

Acceptatiecriteria:
- De productiebundle bevat geen VITE_ENCRYPTION_KEY, geen encrypt/decrypt-code en geen n8n-token.
- In het netwerkverkeer van de browser komt geen request naar het n8n-domein meer voor.
- Een aanroep met een assistent, gesprek of document van een andere organisatie geeft 403; zonder geldige sessie 401.
- Het token is via de Supabase REST API niet leesbaar voor de rollen anon en authenticated.
- Een assistent met twee kennisbronnen stuurt beide namen als lijst naar n8n.
- Elke foutsituatie (geen configuratie, n8n onbereikbaar, auth-fout bij n8n, time-out, n8n-fout) geeft een Nederlandse foutmelding met foutcode in de UI (constitution V).
- Geen berichtinhoud in de logs van de Edge Functions (constitution III).

Buiten scope: wijzigingen aan de n8n-workflows, berichten serverside opslaan, herontwerp van de chat-UI.
```

### A2 · /speckit.plan

```text
Technische route:

1. Supabase Edge Functions (Deno), in stijl en auth-patroon gelijk aan supabase/functions/invite-user/index.ts.
   a. rag-chat: POST { assistant_id, conversation_id, message }.
      - Valideer het JWT. Lees met een client die het Authorization-header van de gebruiker doorgeeft, zodat RLS blijft gelden: profiel, assistent (zelfde organisatie, actief), gesprek (van deze gebruiker, zelfde assistent), gekoppelde kennisbronnen, organisatienaam en de laatste 20 berichten.
      - Lees flow_configs (flow_type 'rag_chat') met de service role: webhook_url, webhook_auth_header, webhook_token.
      - Bouw de payload volgens specs/002-rag-assistant-management/contracts/webhook-contract.md en voeg knowledge_sources: string[] (namen) toe. Behoud knowledgeSourceName als legacy-veld (namen gescheiden door ", ") totdat n8n is aangepast.
      - fetch naar n8n met een time-out van 60 s.
      - Normaliseer de respons serverside (port extractWebhookResponse uit src/lib/webhook.ts) naar:
        { answer: string, sources: { title: string, excerpt: string }[], verification: { grounded: boolean, confidence: number, issues: string[] } | null, rewritten_query: string | null }
        n8n levert verification_grounded, verification_confidence, verification_issues en rewritten_query al mee.
      - Fouten als JSON { code, message } met de codes UNAUTHORIZED, FORBIDDEN, NOT_CONFIGURED, UPSTREAM_AUTH, UPSTREAM_ERROR, UPSTREAM_TIMEOUT, UPSTREAM_UNREACHABLE. Log alleen code, id's en duur; nooit message, answer of history.
   b. document-webhook: POST { document_id, action: 'index' | 'modify' | 'delete' }. Controleer de organisatie. Maak voor 'index' de signed URL (900 s) serverside. Payload gelijk aan de huidige callDocumentWebhook.
   c. flow-config: POST { action: 'get' | 'save' | 'test', flow_type, webhook_url?, webhook_auth_header?, webhook_token? }. Alleen voor beheerders (profiles.role = 'admin').
      - 'get' geeft de configuratie zonder token terug, plus has_token: boolean.
      - 'save' schrijft het token als platte tekst in flow_configs.webhook_token; een leeg token laat het bestaande token staan.
      - 'test' voert de bestaande connectivity-test (zie testWebhook) serverside uit.
   d. CORS: Access-Control-Allow-Origin uit de env-var ALLOWED_ORIGINS (komma-gescheiden), niet '*'.

2. Migratie (volgend nummer in supabase/migrations/):
   - REVOKE SELECT ON flow_configs FROM anon, authenticated;
     GRANT SELECT (id, flow_type, webhook_url, webhook_auth_header, organization_id, created_at, updated_at) ON flow_configs TO authenticated;
   - UPDATE flow_configs SET webhook_token = '';  (de oude tokens zijn gelekt en worden vervangen)
   - Pas de frontend-queries op flow_configs aan (src/hooks/queries.ts rond regel 288 en 632): expliciete kolommen, nooit '*'.

3. Frontend:
   - Nieuw src/lib/rag-client.ts: typed client rond supabase.functions.invoke('rag-chat'), zod-validatie van respons en foutcodes, Nederlandse fouttekst per code.
   - ChatWindow in src/pages/AssistantsPage.tsx gebruikt rag-client in plaats van callRagWebhook. Het opslaan van berichten blijft voorlopig zoals het is.
   - src/lib/storage.ts roept document-webhook aan. src/pages/SettingsPage.tsx gebruikt flow-config; het tokenveld wordt write-only (leeg = ongewijzigd; placeholder "Token is ingesteld" als has_token).
   - Verwijder uit src/lib/webhook.ts wat niet meer gebruikt wordt (encryptToken, decryptToken, callRagWebhook, callDocumentWebhook, testWebhook, kbCache). Verwijder VITE_ENCRYPTION_KEY uit .env.example en src/vite-env.d.ts.
   - src/lib/analysis-client.ts: Authorization: Bearer <access_token> uit supabase.auth.getSession() op alle drie de calls. De mock server mag de header negeren.

4. Fitness: voeg aan scripts/fitness-check.sh een check toe die faalt als 'VITE_ENCRYPTION_KEY' of 'crypto.subtle.decrypt' in src/ voorkomt.

5. Tests: Playwright met page.route op '**/functions/v1/rag-chat' voor succes en voor elke foutcode (de UI toont de juiste melding). Verifieer de Edge Functions met curl-scenario's in quickstart.md: 401 zonder JWT, 403 met een assistent van een andere organisatie, 200 normaal.

6. quickstart.md met de handmatige stappen voor Jaap: functies deployen via Supabase MCP, ALLOWED_ORIGINS zetten, een nieuw token genereren en in de n8n-credential "Darwin auth" zetten, het token invoeren in Instellingen, VITE_ENCRYPTION_KEY uit Netlify verwijderen, opnieuw deployen en met grep op dist/ controleren dat de oude sleutel weg is.
   Releasevolgorde (dit Supabase-project is ook productie): eerst de Edge Functions deployen, dan de nieuwe frontend op main, en pas daarna de REVOKE-migratie. Andersom breekt de chat in de live app, omdat de oude frontend flow_configs met '*' leest.

Randvoorwaarden:
- Lees eerst AGENTS.md, .specify/memory/constitution.md en alle genoemde bestanden volledig.
- Raak alleen bestanden aan die deze spec nodig heeft; geen refactors ernaast.
- Geen nieuwe npm-dependencies.
- UI-tekst Nederlands in u-vorm; code, identifiers en commits Engels.
- Geen klantinhoud in URL's, console, logs, PostHog of browseropslag.
- Klaar = tsc, eslint (max-warnings 0), npm run build en de Playwright-tests van deze feature groen.
- Onduidelijk contract of conflict met de constitution: stop en vraag.
```

---

## B. Rollen: beheer alleen voor beheerders

### B1 · /speckit.specify

```text
Beheerfuncties alleen voor beheerders.

Huidige situatie:
- Volgens de RLS-policies (supabase/migrations/001_initial_schema.sql) mag elk lid van een organisatie assistenten, kennisbronnen, documenten en koppelingen aanmaken, wijzigen en verwijderen. Een assistent verwijderen verwijdert ook alle gesprekken.
- De UI toont bewerkknoppen, webhook-URL's en kennisbronkoppelingen aan iedereen.
- Assistentkaarten tonen de technische typewaarde ("chat", "risico_analyse"), vallen zonder beschrijving terug op de system prompt, en inactieve assistenten zijn voor adviseurs zichtbaar en bruikbaar.

User stories:
1. (P1) Als adviseur (rol member) zie ik alleen actieve assistenten, met een leesbaar type en een omschrijving. Ik kan ze starten, maar niet aanmaken, bewerken of verwijderen.
2. (P1) Als adviseur zie ik Kennisbronnen alleen-lezen: welke bronnen er zijn, welke documenten erin zitten en hun status. Uploaden, bewerken en verwijderen zie ik niet.
3. (P1) Als beheerder (rol admin) houd ik alle huidige beheermogelijkheden. Inactieve assistenten zie ik met het label "Inactief".
4. (P1) De database dwingt dit af, ook als iemand de UI omzeilt.

Acceptatiecriteria:
- Een member krijgt bij insert, update of delete op ai_assistants, knowledge_bases, knowledge_base_documents, knowledge_items en assistant_knowledge_bases een RLS-weigering. Lezen binnen de eigen organisatie blijft werken.
- Een member kan geen bestanden uploaden naar of verwijderen uit de storage-bucket knowledge-documents.
- Eigen gesprekken, berichten en feedback blijven voor members werken.
- De system prompt wordt nergens in de UI aan members getoond.
- Typelabels: chat wordt "Chat", risico_analyse wordt "Risico-analyse".
- Verborgen knoppen zijn ook niet via het toetsenbord bereikbaar (niet alleen visueel verborgen).

Buiten scope: nieuwe rollen, rechten per assistent, de pagina's Team en Instellingen (die zijn al admin-only).
```

### B2 · /speckit.plan

```text
Technische route:

1. Migratie (volgend nummer):
   - Functie public.is_org_admin() RETURNS boolean, SECURITY DEFINER, STABLE, met vaste search_path: er bestaat een profiel met id = auth.uid() en role = 'admin'.
   - Vervang op ai_assistants, knowledge_bases, knowledge_base_documents, knowledge_items en assistant_knowledge_bases de INSERT-, UPDATE- en DELETE-policies door varianten met de bestaande organisatiecheck én is_org_admin(). Laat de SELECT-policies ongemoeid. De policies op assistant_knowledge_bases uit 007_multitenancy_hardening.sql controleren zowel assistent als kennisbron; behoud dat.
   - Storage: bekijk via Supabase MCP de huidige policies op storage.objects voor de bucket 'knowledge-documents' en beperk insert, update en delete tot beheerders van de organisatie die in het pad staat (het pad begint met organization_id).
   - Verifieer na het toepassen via Supabase MCP met een member- en een admin-JWT (set_config 'request.jwt.claims') en leg de queries vast in quickstart.md.

2. Frontend:
   - Hook useIsAdmin() (profile?.role === 'admin') in src/hooks/useAuth.ts.
   - src/pages/AssistantsPage.tsx: "Nieuwe assistent", het potlood en AssistantModal alleen voor admins. Filter inactieve assistenten weg voor members. Kaarttekst = description, anders niets (nooit system_prompt). Typebadge via een label-map.
   - src/pages/KnowledgePage.tsx: "Nieuwe kennisbron", "Bewerken", de uploadzone, de verwijderknoppen en het formulier in het tabblad Kennisitems alleen voor admins.
   - Gebruik conditional rendering, geen CSS-hiding.

3. Tests: Playwright met een tweede testaccount via E2E_MEMBER_EMAIL en E2E_MEMBER_PASSWORD; skip met een duidelijke reden als die ontbreken, zoals tests/e2e/fixtures.ts dat al doet. Scenario's: een member ziet geen beheerknoppen en geen inactieve assistent; een admin wel.

Randvoorwaarden:
- Lees eerst AGENTS.md, .specify/memory/constitution.md en alle genoemde bestanden volledig.
- Raak alleen bestanden aan die deze spec nodig heeft; geen refactors ernaast.
- Geen nieuwe npm-dependencies.
- UI-tekst Nederlands in u-vorm; code, identifiers en commits Engels.
- Geen klantinhoud in URL's, console, logs, PostHog of browseropslag.
- Klaar = tsc, eslint (max-warnings 0), npm run build en de Playwright-tests van deze feature groen.
- Onduidelijk contract of conflict met de constitution: stop en vraag.
```

---

## C. Toegankelijke dialogen en zijpanelen

### C1 · /speckit.specify

```text
Toegankelijke dialogen en zijpanelen.

Huidige situatie:
- src/components/ui/dialog.tsx is een eigen implementatie zonder focus trap en zonder role="dialog"/aria-modal. Bij een geneste dialoog (de verwijderbevestiging in de assistent-modal) sluit Escape beide lagen tegelijk.
- Zijpanelen (de kennisbron-slide-over in src/pages/KnowledgePage.tsx en het bronpaneel src/components/analysis/SourcePanel.tsx) sluiten niet met Escape, houden de focus niet vast en geven de focus niet terug aan de knop die ze opende.
- Kennisbronkaarten zijn klikbare div's en niet met het toetsenbord te openen.
- Dit is in strijd met constitution IV (WCAG 2.1 AA).

User stories:
1. (P1) Als toetsenbordgebruiker kan ik elke dialoog en elk zijpaneel openen, bedienen en met Escape sluiten. De focus blijft binnen het open venster en keert daarna terug naar de knop of kaart waarmee ik het opende.
2. (P1) Bij een geneste dialoog sluit Escape alleen de bovenste laag.
3. (P1) Kennisbronkaarten zijn met Tab bereikbaar en met Enter te openen.
4. (P2) Een schermlezer leest bij openen de titel van de dialoog of het paneel voor.

Acceptatiecriteria:
- Alle bestaande dialogen en de twee genoemde zijpanelen voldoen hieraan en zien er visueel hetzelfde uit (zelfde breedte, kleuren en spacing).
- Geen gedragswijziging op de pagina's buiten openen, sluiten en focus.

Buiten scope: het chatpaneel in AssistantsPage, het gesprekspaneel in HistoryPage en het analysepaneel AnalysisFlow; die worden in latere features vervangen door pagina's.
```

### C2 · /speckit.plan

```text
Technische route:

1. Herschrijf src/components/ui/dialog.tsx op @radix-ui/react-dialog (staat al in package.json maar wordt niet gebruikt). Behoud de exportnamen en props (Dialog {open, onOpenChange, children}, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter), zodat aanroepers niet hoeven te veranderen.
   - Dialog = Root + Portal + Overlay + Content, met dezelfde classes als nu (max-w-lg, max-h-[85vh], rounded-lg, border, shadow-lg).
   - DialogTitle = Radix Title, DialogDescription = Radix Description.
   - Controleer elke plek die <Dialog gebruikt op een DialogTitle; Radix vereist die.
2. Nieuw src/components/ui/sheet.tsx op dezelfde Radix-basis: rechterpaneel met prop size: 'md' (max-w-md) | 'lg' (max-w-lg), overlay, SheetHeader, SheetTitle en een scrollbare SheetBody.
3. Migreer KBSlideOver in KnowledgePage en SourcePanel naar Sheet. SourcePanel houdt zijn props (bronId, bronnen, onClose); open = bronId !== null.
4. Maak de kennisbronkaarten bedienbaar met het toetsenbord: een button als klikbaar element binnen de kaart, of de kaart zelf als button met de juiste rol en focusstijl. De knop "Bewerken" blijft apart bereikbaar.
5. Tests (Playwright): Escape sluit de kennisbron-slide-over en de focus keert terug op de kaart; in de assistent-modal sluit Escape bij een open verwijderbevestiging alleen de bevestiging; Tab blijft binnen een open dialoog; een kennisbronkaart opent met Enter.

Randvoorwaarden:
- Lees eerst AGENTS.md, .specify/memory/constitution.md en alle genoemde bestanden volledig.
- Raak alleen bestanden aan die deze spec nodig heeft; geen refactors ernaast.
- Geen nieuwe npm-dependencies.
- UI-tekst Nederlands in u-vorm; code, identifiers en commits Engels.
- Geen klantinhoud in URL's, console, logs, PostHog of browseropslag.
- Klaar = tsc, eslint (max-warnings 0), npm run build en de Playwright-tests van deze feature groen.
- Onduidelijk contract of conflict met de constitution: stop en vraag.
```

---

## D. Chat als eigen pagina

### D1 · /speckit.specify

```text
Chat als eigen pagina met hervatbare gesprekken.

Huidige situatie:
- De chat is een zijpaneel van 480 px in src/pages/AssistantsPage.tsx (ChatWindow). Dat is te smal voor antwoorden met opsommingen. Sluiten en opnieuw openen begint een nieuw gesprek, de terugknop van de browser verlaat de pagina, en een gesprek is niet te hervatten.
- Elk gesprek heet "Chat met <assistent>".
- Het invoerveld is één regel; lange vragen zijn onhandig.
- Fouten verschijnen als toast die verdwijnt, terwijl het invoerveld al leeg is.
- Het lege gesprek legt niet uit wat de assistent kan.
- Berichten worden vanuit de browser opgeslagen, het assistentantwoord zonder wachten op het resultaat. Bij een fout kan een gesprek half opgeslagen zijn.

User stories:
1. (P1) Als adviseur open ik een assistent en kom ik op een chatpagina met een eigen adres. Na mijn eerste vraag krijgt het gesprek een vast adres, zodat ik kan herladen, terugnavigeren en later verdergaan.
2. (P1) Ik typ mijn vraag in een meerregelig veld: Enter verstuurt, Shift+Enter geeft een nieuwe regel.
3. (P1) Mislukt een antwoord, dan zie ik bij mijn vraag een melding met de reden en een knop "Opnieuw proberen". Mijn vraag wordt niet dubbel opgeslagen.
4. (P2) Een nieuw gesprek toont maximaal vier voorbeeldvragen die de beheerder per assistent instelt; een klik stelt die vraag.
5. (P2) Onder elk antwoord staat een knop om het antwoord te kopiëren.
6. (P2) Met "Nieuw gesprek" begin ik opnieuw bij dezelfde assistent.
7. (P2) Het gesprek krijgt als titel de eerste vraag, afgekapt op 80 tekens.
8. (P3) Duurt een antwoord langer dan 15 seconden, dan zie ik dat het langer duurt dan gebruikelijk.

Acceptatiecriteria:
- Adressen bevatten alleen id's, nooit vraagtekst of klantgegevens (constitution III).
- Gebruikers- en assistentberichten worden serverside opgeslagen in dezelfde aanroep die het antwoord ophaalt. Een herhaalde poging met hetzelfde bericht-id maakt geen dubbel bericht.
- Een gesprek van een andere gebruiker openen geeft de melding "Gesprek niet gevonden", geen lege pagina.
- De bestaande gespreksbrede duim-feedback en de huidige bronnenweergave blijven werken zoals nu; die worden in latere features vervangen.
- Alle acties zijn met het toetsenbord bereikbaar; na versturen staat de focus weer in het invoerveld.

Buiten scope: de weergave van antwoorden (markdown, bronnen, CONCEPT-label), feedback per antwoord, de Geschiedenis-pagina, de risico-analyse.
```

### D2 · /speckit.plan

```text
Technische route:

1. Routes in src/App.tsx, binnen AppShell: /chat/new/:assistantId en /chat/:conversationId. Nieuwe lazy pagina src/pages/ChatPage.tsx. Componenten in src/components/chat/: ChatHeader, MessageList, MessageBubble (gebruikt de bestaande MessageContent), ChatComposer, ChatEmptyState. Verwijder ChatWindow uit AssistantsPage; de knop "Chat" op de kaart navigeert naar /chat/new/:id.

2. Breid de Edge Function rag-chat (feature A) uit:
   - Request: { assistant_id, conversation_id?: string, message_id: string (uuid, door de client gegenereerd), message }.
   - Zonder conversation_id: maak het gesprek aan met title = eerste vraag, getrimd, maximaal 80 tekens plus '…'.
   - Upsert het gebruikersbericht met id = message_id (ON CONFLICT DO NOTHING), haal het antwoord op, sla het assistentbericht op en update conversations.updated_at.
   - Response: { conversation_id, user_message_id, assistant_message: { id, content, sources, created_at }, verification, rewritten_query }.
   - Schrijf met de service role pas nadat het eigendom van gesprek en assistent is gecontroleerd.

3. Frontend:
   - ChatPage laadt bij /chat/:conversationId het gesprek en de berichten (bestaande useConversationMessages) en bij /chat/new/:assistantId een leeg gesprek. Na het eerste antwoord: navigate('/chat/' + id, { replace: true }).
   - Toon het gebruikersbericht direct. Bij een fout blijft de tekst staan, met foutmelding en "Opnieuw proberen" (zelfde message_id).
   - ChatComposer: Textarea, groeit mee tot 8 regels, Enter verstuurt, Shift+Enter geeft een nieuwe regel, uitgeschakeld tijdens versturen.
   - Wachttekst "Antwoord wordt opgesteld…", na 15 s aangevuld met "Dit duurt langer dan gebruikelijk."
   - Kopieerknop per assistentbericht (navigator.clipboard, toast "Gekopieerd").
   - Verplaats de bestaande gespreksbrede feedbackbalk ongewijzigd naar ChatPage.

4. Voorbeeldvragen: migratie ai_assistants.example_questions text[] NOT NULL DEFAULT '{}'; src/types/database.types.ts bijwerken. In AssistantModal (alleen admin) een textarea "Voorbeeldvragen (één per regel, maximaal 4)". ChatEmptyState toont ze als knoppen die de vraag direct versturen.

5. Tests (Playwright, rag-chat gemockt met page.route): een nieuw gesprek krijgt de URL /chat/<uuid>; Shift+Enter maakt een nieuwe regel; fout → melding → opnieuw proberen → het antwoord verschijnt en er staat één gebruikersbericht; een klik op een voorbeeldvraag verstuurt die. Persistentie na herladen handmatig verifiëren met de echte Edge Function volgens quickstart.md.

Randvoorwaarden:
- Lees eerst AGENTS.md, .specify/memory/constitution.md en alle genoemde bestanden volledig.
- Raak alleen bestanden aan die deze spec nodig heeft; geen refactors ernaast.
- Geen nieuwe npm-dependencies.
- UI-tekst Nederlands in u-vorm; code, identifiers en commits Engels.
- Geen klantinhoud in URL's, console, logs, PostHog of browseropslag.
- Klaar = tsc, eslint (max-warnings 0), npm run build en de Playwright-tests van deze feature groen.
- Onduidelijk contract of conflict met de constitution: stop en vraag.
```

---

## E. Feedback per antwoord en meetgegevens

### E1 · /speckit.specify

```text
Feedback per antwoord, en vastleggen hoe een antwoord tot stand kwam.

Huidige situatie:
- Feedback (feedback_interactions) hoort bij een heel gesprek. Na één duim kan niets meer beoordeeld worden en is niet te zien welk antwoord fout was.
- Een duim omlaag vereist verplicht tekst; dat remt feedback.
- Van een antwoord worden alleen tekst en bronnen bewaard. De herschreven zoekvraag, het verificatie-oordeel en de responstijd gaan verloren, terwijl n8n ze meelevert. Daardoor is achteraf niet te analyseren waarom een antwoord fout ging, en kan feedback niet omgezet worden in testcases.

User stories:
1. (P1) Als adviseur geef ik per antwoord een duim omhoog of omlaag.
2. (P1) Bij een duim omlaag kies ik een reden (Onjuist, Onvolledig, Bron klopt niet, Vraag niet begrepen, Anders) en kan ik optioneel een toelichting geven.
3. (P1) Mijn oordeel per antwoord is na herladen nog zichtbaar en ik kan het wijzigen.
4. (P2) Bij elk opgeslagen antwoord staan de herschreven zoekvraag, de verificatie (grounded, confidence, issues) en de responstijd.
5. (P2) Als beheerder kan ik de negatieve feedback met vraag, antwoord en verificatie in één overzicht opvragen (een databasefunctie, geen UI).

Acceptatiecriteria:
- Eén oordeel per gebruiker per antwoord; wijzigen overschrijft het vorige.
- Feedback is alleen mogelijk op berichten in eigen gesprekken (RLS).
- Bestaande gespreksbrede feedback blijft bewaard, maar de UI toont alleen nog feedback per antwoord.
- Het overzicht is alleen opvraagbaar door beheerders, en alleen voor de eigen organisatie.
- Duimknoppen hebben aria-pressed en een toegankelijk label.

Buiten scope: een beheerscherm voor feedback, automatische evaluatie, wijzigingen aan n8n.
```

### E2 · /speckit.plan

```text
Technische route:

1. Migratie (volgend nummer):
   - messages: de kolommen rewritten_query text, verification jsonb en latency_ms integer (alle nullable).
   - feedback_interactions: message_id uuid REFERENCES messages(id) ON DELETE CASCADE (nullable voor oude rijen), reason text CHECK (reason IN ('incorrect','incomplete','wrong_source','misunderstood','other')), updated_at timestamptz. Unieke index op (message_id, user_id) WHERE message_id IS NOT NULL. RLS: insert en update alleen als het bericht in een gesprek van auth.uid() zit.
   - Functie public.get_feedback_review() RETURNS TABLE, SECURITY DEFINER, vaste search_path: feedback + de bijbehorende gebruikersvraag (het voorgaande user-bericht in hetzelfde gesprek) + antwoord + verification + rewritten_query + assistent + datum. Geeft niets terug tenzij is_org_admin() (feature B), en filtert op get_user_org_id(). Gebruik geen view met security_invoker: de RLS op messages laat een beheerder alleen zijn eigen berichten zien, dus die view zou leeg blijven.
   - Werk src/types/database.types.ts bij.

2. Edge Function rag-chat: sla rewritten_query, verification en latency_ms op bij het assistentbericht.

3. Frontend:
   - Component src/components/chat/AnswerFeedback.tsx onder elk assistentbericht: duim omhoog of omlaag (upsert); bij omlaag een klein formulier met de reden als radiogroep, een optionele textarea en de knoppen Versturen en Annuleren.
   - Hook in src/hooks/queries.ts: useMessageFeedback(conversationId) laadt alle oordelen van de gebruiker voor dat gesprek in één query.
   - Verwijder de gespreksbrede feedbackbalk uit ChatPage, en useFeedbackInteraction als die niet meer gebruikt wordt.

4. Tests (Playwright): seed in de test-setup een gesprek met berichten via de Supabase-client van het testaccount (rag-chat is hiervoor niet nodig). Scenario's: duim omhoog per antwoord; duim omlaag met reden en zonder toelichting; een oordeel wijzigen; na herladen staat het oordeel er nog.

Randvoorwaarden:
- Lees eerst AGENTS.md, .specify/memory/constitution.md en alle genoemde bestanden volledig.
- Raak alleen bestanden aan die deze spec nodig heeft; geen refactors ernaast.
- Geen nieuwe npm-dependencies.
- UI-tekst Nederlands in u-vorm; code, identifiers en commits Engels.
- Geen klantinhoud in URL's, console, logs, PostHog of browseropslag.
- Klaar = tsc, eslint (max-warnings 0), npm run build en de Playwright-tests van deze feature groen.
- Onduidelijk contract of conflict met de constitution: stop en vraag.
```

---

## F. Antwoordweergave en vertrouwen

### F1 · /speckit.specify

```text
Antwoorden leesbaar, controleerbaar en als CONCEPT gemarkeerd.

Huidige situatie:
- Antwoorden worden als HTML gesaniteerd (src/components/chat/MessageContent.tsx met sanitizeHtml), maar n8n levert platte tekst of markdown. Het resultaat is één lap tekst met losse sterretjes.
- Gebruikersberichten gaan door dezelfde HTML-sanitizer; ingetypte tags worden als opmaak getoond.
- Bij elke bron staat een percentage (bijvoorbeeld 100%). Dat is de zelfbeoordeling van het taalmodel en geen betrouwbaarheid, maar adviseurs lezen het wel zo.
- Het verificatie-oordeel van n8n (grounded, confidence, issues) wordt niet getoond.
- Chatantwoorden dragen geen CONCEPT-label, terwijl constitution II dat voor elke gegenereerde output eist.
- Bronnen zijn een uitklaplijst met titel en fragment; een bron rustig bekijken kan niet.

User stories:
1. (P1) Als adviseur zie ik antwoorden met opmaak: alinea's, opsommingen, vet en tabellen.
2. (P1) Elk antwoord draagt zichtbaar het label CONCEPT.
3. (P1) Is een antwoord niet volledig onderbouwd door de bronnen, dan zie ik een duidelijke waarschuwing met de gevonden problemen. Bij een onderbouwd antwoord zie ik "Gecontroleerd tegen de bronnen".
4. (P1) Onder elk antwoord staan de bronnen als genummerde knoppen [1], [2] met de documentnaam. Een klik opent een zijpaneel met document, locatie (indien bekend) en de letterlijke passage.
5. (P2) Mijn eigen vraag zie ik precies zoals ik hem typte, met regeleinden.

Acceptatiecriteria:
- Geen percentages of scores meer bij bronnen.
- Oude berichten zonder verificatiegegevens tonen geen verificatieregel en geen foutmelding.
- Markdown wordt gesaniteerd met de bestaande sanitizeMarkdown; links openen in een nieuw tabblad met rel="noopener noreferrer".
- De waarschuwing verschijnt bij grounded = false of confidence < 0,7; de drempel is een constante in de code.
- Het bronpaneel is met het toetsenbord te openen en met Escape te sluiten; de focus keert terug naar de bronknop.
- Nieuwe UI-teksten bevatten geen aanbevelende formuleringen (constitution II).

Buiten scope: wijzigingen aan n8n (bronverwijzingen in de tekst, paginanummers), de Geschiedenis-pagina.
```

### F2 · /speckit.plan

```text
Technische route:

1. MessageContent krijgt een prop role. Assistent: sanitizeMarkdown (src/lib/sanitize.ts). Gebruiker: platte tekst met whitespace-pre-wrap, geen HTML. Opmaak voor markdown via Tailwind-classes op de container (ul, ol, li, strong, table, th, td); voeg @tailwindcss/typography niet toe.
2. Nieuw src/components/chat/AnswerMeta.tsx onder elk assistentbericht: CONCEPT-badge, verificatieregel op basis van message.verification (velden uit feature E) en de bronknoppen.
3. Bronpaneel: hergebruik src/components/analysis/SourcePanel.tsx (sinds feature C een Sheet). Map chatbronnen naar BronRef: id = 'K' + (index + 1), document = title, locatie = page ?? '', passage = excerpt. Pas SourcePanel minimaal aan zodat Locatie verborgen is als die leeg is. Verder geen wijzigingen aan de analyse-flow.
4. Verwijder de score-badge en de uitklaplijst met bronnen uit de chatweergave.
5. Tests (Playwright, rag-chat gemockt): een markdown-lijst rendert als lijst; het CONCEPT-label is aanwezig; waarschuwing bij grounded=false; een bronknop opent het paneel, Escape sluit het en de focus keert terug; geen '%' bij bronnen; een XSS-poging in het antwoord (<img src=x onerror=...>) wordt niet uitgevoerd.

Randvoorwaarden:
- Lees eerst AGENTS.md, .specify/memory/constitution.md en alle genoemde bestanden volledig.
- Raak alleen bestanden aan die deze spec nodig heeft; geen refactors ernaast.
- Geen nieuwe npm-dependencies.
- UI-tekst Nederlands in u-vorm; code, identifiers en commits Engels.
- Geen klantinhoud in URL's, console, logs, PostHog of browseropslag.
- Klaar = tsc, eslint (max-warnings 0), npm run build en de Playwright-tests van deze feature groen.
- Onduidelijk contract of conflict met de constitution: stop en vraag.
```

---

## G. Risico-analyse als eigen pagina

### G1 · /speckit.specify

```text
Risico-analyse als eigen pagina, met soepelere invoer.

Huidige situatie:
- De risico-analyse draait in een zijpaneel (src/components/analysis/AnalysisFlow.tsx). Een analyse duurt 1 tot 3 minuten; wie het paneel sluit, ziet nergens dat de analyse klaar is.
- Recente analyses staan alleen in een lijst binnen het formulier.
- Het formulier begint met het vraagstuk en de klantreferentie staat onderaan, terwijl een adviseur vanuit de klant denkt.
- De kennisbronnenkeuze ("De selectie bepaalt het verzekeringstype") is systeemlogica; de adviseur moet zelf bronnen aanvinken.
- "Opnieuw" na een mislukte analyse vult het formulier opnieuw, maar laat bijlagen zonder melding weg.
- De vervaldatum van een resultaat (7 dagen) staat alleen klein in het resultaat zelf.

User stories:
1. (P1) Als adviseur start ik een analyse op een eigen pagina en volg ik de status op een eigen adres per analyse. Ik kan wegnavigeren en via dat adres of de lijst terugkeren.
2. (P1) Overal in de app zie ik in de zijbalk hoeveel van mijn analyses sinds mijn laatste bezoek klaar of mislukt zijn; de titel van het browsertabblad toont dat aantal.
3. (P1) In het formulier staat Klantreferentie bovenaan. Adviseur staat als vaste tekst in de kop.
4. (P2) Alle kennisbronnen van de assistent zijn standaard aangevinkt; ik kan er een uitzetten.
5. (P2) Bij "Opnieuw" zie ik de melding dat bijlagen niet bewaard zijn en opnieuw toegevoegd moeten worden.
6. (P2) In de lijst met recente analyses zie ik per analyse tot wanneer het resultaat beschikbaar is.
7. (P3) Ik kan bestanden ook naar het uploadvak slepen, en het veld Verzekeringsvraagstuk toont een voorbeeldtekst.

Acceptatiecriteria:
- Adressen bevatten alleen run-id's en assistent-id's, nooit klantreferentie of inhoud (constitution III). De tabbladtitel bevat nooit een klantreferentie.
- Het CONCEPT-label blijft overal staan waar het nu staat (constitution II).
- De statusindicator pollt alleen zolang er lopende analyses zijn.
- Slepen en neerzetten heeft een toetsenbordalternatief: de bestaande knop blijft.
- De bestaande Playwright-tests in tests/e2e/analysis-*.spec.ts blijven slagen, aangepast aan de nieuwe routes waar nodig.

Buiten scope: wijzigingen aan het backendcontract (behalve het veld expires_at in de lijst, zie plan), de inhoud van het resultaat, de Geschiedenis-pagina.
```

### G2 · /speckit.plan

```text
Technische route:

1. Routes: /analyse/new/:assistantId (formulier + recente analyses) en /analyse/:runId (RunCard + ResultView). Nieuwe pagina's src/pages/AnalysisNewPage.tsx en src/pages/AnalysisRunPage.tsx; hergebruik AnalysisForm, RunCard, ResultView en RecentRunsPanel. AnalysisFlow vervalt; de kaartknop op AssistantsPage navigeert.
2. Retry-snapshot: de huidige Map retrySnapshots blijft in-memory op module-niveau, zonder browseropslag (constitution III). Bij retry navigeren naar /analyse/new/:assistantId met router state { retryRunId }.
3. Zijbalkindicator: hook useAnalysisNotifications in src/hooks/, gebaseerd op fetchRecentRuns (src/lib/analysis-client.ts).
   - 'Gezien' = een set run-id's in sessionStorage (alleen id's, geen inhoud).
   - refetchInterval 10 s zolang er runs met status queued of running zijn, anders geen polling.
   - Badge in AppShell bij het menu-item Assistenten; document.title = '(n) Darwin' als n > 0.
4. AnalysisForm:
   - Volgorde: Klantreferentie, Verzekeringsvraagstuk, Kennisbronnen, Klantsituatie, Bestanden, URL's. Adviseur als tekst in de paginakop.
   - Kennisbronnen bij een nieuw formulier allemaal aangevinkt; bij retry de eerdere keuze. Vervang de hulptekst door "Standaard zijn alle kennisbronnen van deze assistent geselecteerd."
   - Placeholder Verzekeringsvraagstuk: "Bijvoorbeeld: de klant twijfelt of een aansprakelijkheidsverzekering voor zijn eenmanszaak nodig is."
   - Slepen en neerzetten op het bestandsvak (onDragOver/onDrop) naast de bestaande knop.
5. RecentRunSchema in src/lib/analysis-schemas.ts heeft nog geen expires_at. Voeg het veld toe aan het schema en aan scripts/mock-analysis-server.mjs, noteer de contractwijziging in specs/008-risico-analyse-ui/contracts/run-status.md, en toon "beschikbaar tot dd-mm-jjjj" in RecentRunsPanel.
6. Tests: de bestaande analysis-specs aanpassen aan de routes. Nieuw: de indicator toont 1 na een voltooide mock-run en verdwijnt na openen; Klantreferentie staat bovenaan; retry toont de bijlagenmelding.

Randvoorwaarden:
- Lees eerst AGENTS.md, .specify/memory/constitution.md en alle genoemde bestanden volledig.
- Raak alleen bestanden aan die deze spec nodig heeft; geen refactors ernaast.
- Geen nieuwe npm-dependencies.
- UI-tekst Nederlands in u-vorm; code, identifiers en commits Engels.
- Geen klantinhoud in URL's, console, logs, PostHog of browseropslag.
- Klaar = tsc, eslint (max-warnings 0), npm run build en de Playwright-tests van deze feature groen.
- Onduidelijk contract of conflict met de constitution: stop en vraag.
```

---

## H. Startscherm en Geschiedenis

### H1 · /speckit.specify

```text
Startscherm rond de vraag en één overzicht van eerder werk.

Huidige situatie:
- Command Center (src/pages/CommandCenterPage.tsx) toont tellers (assistenten, kennisbronnen, teamleden) en een placeholder "Taken". Daar heeft een adviseur niets aan.
- Geschiedenis (src/pages/HistoryPage.tsx) belooft "alle eerdere runs" maar toont alleen chatgesprekken; risico-analyses ontbreken. De badge Nieuw/Afgerond zegt niets. Gesprekken openen alleen-lezen in een paneel, verdergaan kan niet, en zoeken kan niet.
- Rijen zijn klikbare kaarten die niet met het toetsenbord bereikbaar zijn.

User stories:
1. (P1) Als adviseur kom ik na inloggen op een startscherm met één vraagveld en een keuze uit de actieve chat-assistenten. Versturen opent een nieuw gesprek met die vraag.
2. (P1) Op het startscherm zie ik mijn vijf laatste gesprekken, mijn vijf laatste risico-analyses met status, en een knop "Nieuwe risico-analyse" als er een risico-analyse-assistent is.
3. (P1) In Geschiedenis zie ik gesprekken en risico-analyses in twee tabbladen. Een gesprek openen brengt me naar het gesprek zelf, waar ik verder kan.
4. (P2) Ik kan in Geschiedenis zoeken op gesprekstitel of klantreferentie.

Acceptatiecriteria:
- De vraag van het startscherm komt nooit in het adres of in browseropslag terecht (constitution III).
- Zoeken gebeurt in de browser op de al geladen lijst; er komt geen zoekterm in request-URL's.
- De oude route /command-center verwijst door naar het startscherm.
- Rijen en kaarten zijn links of knoppen, bereikbaar met Tab en te openen met Enter.
- Lege toestanden hebben een korte uitleg en een actie.

Buiten scope: tellers of statistieken voor beheerders, filters naast zoeken, wijzigingen aan de chat- of analysepagina.
```

### H2 · /speckit.plan

```text
Technische route:

1. Route /start met de nieuwe pagina src/pages/StartPage.tsx. '/command-center' en '*' verwijzen door naar /start. De standaard redirect na inloggen staat in src/components/auth/LoginPage.tsx (fallback '/command-center'); zet die op '/start'. Menu-item "Start" bovenaan in AppShell. Verwijder CommandCenterPage en useDashboardCounts als ze niet meer gebruikt worden.
2. StartPage: Textarea plus Select met de actieve chat-assistenten (useAssistants, filter is_active && type === 'chat'). Versturen = navigate('/chat/new/' + assistantId, { state: { initialQuestion } }). ChatPage (feature D) verstuurt initialQuestion eenmalig bij mount en wist daarna de router state (navigate met replace en zonder state).
3. Blokken op het startscherm: recente gesprekken (useConversations, limit 5) als links naar /chat/:id; recente analyses (fetchRecentRuns, limit 5) als links naar /analyse/:runId, met statusbadge; een knop naar /analyse/new/:assistantId.
4. HistoryPage: tabbladen Gesprekken en Risico-analyses (bestaand src/components/ui/tabs.tsx).
   - Gesprekken: limit 200; rij = Link naar /chat/:id met titel, assistent en datum laatst bijgewerkt.
   - Risico-analyses: fetchRecentRuns met limit 50; rij = Link naar /analyse/:runId met klantreferentie, status, startdatum en "beschikbaar tot". Het contract noemt nu limiet 10: leg in specs/008-risico-analyse-ui/contracts/run-status.md vast dat limit tot 50 moet kunnen, en controleer dat scripts/mock-analysis-server.mjs dat ondersteunt.
   - Zoekveld filtert client-side. Verwijder ConversationDrawer en de Nieuw/Afgerond-badge.
5. Tests: een vraag op het startscherm opent de chat en wordt verstuurd (rag-chat gemockt) en de URL bevat geen vraagtekst; zoeken in Geschiedenis filtert; een rij opent met Enter; /command-center verwijst door.

Randvoorwaarden:
- Lees eerst AGENTS.md, .specify/memory/constitution.md en alle genoemde bestanden volledig.
- Raak alleen bestanden aan die deze spec nodig heeft; geen refactors ernaast.
- Geen nieuwe npm-dependencies.
- UI-tekst Nederlands in u-vorm; code, identifiers en commits Engels.
- Geen klantinhoud in URL's, console, logs, PostHog of browseropslag.
- Klaar = tsc, eslint (max-warnings 0), npm run build en de Playwright-tests van deze feature groen.
- Onduidelijk contract of conflict met de constitution: stop en vraag.
```

---

## I. Kennisbronnenbeheer

### I1 · /speckit.specify

```text
Kennisbronnenbeheer dat laat zien of een bron bruikbaar is.

Huidige situatie:
- Kennisbronkaarten tonen alleen naam en beschrijving. Of er documenten in zitten en of die verwerkt zijn, zie je pas na openen.
- De documentstatus "Verwerken..." ververst niet vanzelf. De status "Error" is Engels en heeft geen reden; opnieuw verwerken kan niet.
- Documenten en kennisitems worden zonder bevestiging verwijderd.
- Uploaden kan één bestand tegelijk, zonder slepen.
- Het veld "Vector Collection ID" (met uitleg over Pinecone) wordt door de zoekstap niet gebruikt.
- Kennisitems blijven op "Wachtend" staan: er is geen verwerking voor gebouwd.
- De zoekstap in n8n filtert op de naam van de kennisbron. Hernoemen maakt alle documenten van die bron onvindbaar.

User stories:
1. (P1) Als beheerder zie ik op elke kennisbronkaart: het aantal documenten, het aantal met een fout en wanneer de bron voor het laatst is bijgewerkt.
2. (P1) Documentstatussen verversen vanzelf zolang er documenten in verwerking zijn. Een fout toont "Fout", de reden als die bekend is, en een knop "Opnieuw verwerken".
3. (P1) Een document of kennisitem verwijderen vraagt eerst om bevestiging, met de naam erbij.
4. (P1) Zodra een kennisbron documenten bevat, kan ik de naam niet meer wijzigen; een uitleg zegt waarom.
5. (P2) Ik kan meerdere bestanden tegelijk kiezen of slepen; per bestand zie ik voortgang en resultaat.
6. (P2) Het veld Vector Collection ID en het tabblad Kennisitems zijn uit de UI verdwenen.

Acceptatiecriteria:
- De polling stopt zodra er geen documenten met status processing meer zijn.
- Opnieuw verwerken gebruikt de serverroute uit feature A (document-webhook, action 'index') en zet de status op processing.
- Bestaande kolommen en data blijven in de database staan; alleen de UI verandert.
- Slepen en neerzetten heeft een toetsenbordalternatief.
- Beheeracties alleen voor beheerders (feature B); members zien de statusinformatie alleen-lezen.

Buiten scope: verwerking van kennisitems bouwen, wijzigingen aan de n8n-ingestflow, kennisbronnen op id in plaats van naam laten filteren.
```

### I2 · /speckit.plan

```text
Technische route:

1. Migratie: knowledge_base_documents.error_message text NULL; src/types/database.types.ts bijwerken. n8n vult deze kolom later; zolang hij leeg is, toont de UI een algemene fouttekst.
2. Kaartstatistieken: één query die per kennisbron count(*), count(*) FILTER (WHERE status = 'error') en max(updated_at) teruggeeft, via een view knowledge_base_stats WITH (security_invoker = true) of een RPC. Geen N+1-queries.
3. useKnowledgeBaseDocuments: refetchInterval 5 s zolang een document status 'processing' heeft, anders false.
4. "Opnieuw verwerken": zet status op 'processing' en error_message op null, en roep document-webhook aan met action 'index'.
5. Bevestiging via de Dialog uit feature C, met de documentnaam in de tekst.
6. KBMappingModal: naamveld disabled als de kennisbron documenten heeft, met de hulptekst "De naam kan niet worden gewijzigd zolang er documenten in deze kennisbron staan, omdat de zoekfunctie de naam gebruikt." Verwijder het veld Vector Collection ID uit de UI; de kolom en de payload blijven.
7. Upload: input multiple plus een drop-zone. Upload de bestanden na elkaar via de bestaande uploadDocument en toon per bestand de status (wachten, uploaden, klaar, fout).
8. Verberg het tabblad Kennisitems (code laten staan, niet renderen) en noteer dat in FEATURES.md.
9. Tests: bevestiging bij verwijderen; naamveld disabled bij een bron met documenten; multi-upload toont de status per bestand; de polling stopt (mock via page.route op de REST-call).

Randvoorwaarden:
- Lees eerst AGENTS.md, .specify/memory/constitution.md en alle genoemde bestanden volledig.
- Raak alleen bestanden aan die deze spec nodig heeft; geen refactors ernaast.
- Geen nieuwe npm-dependencies.
- UI-tekst Nederlands in u-vorm; code, identifiers en commits Engels.
- Geen klantinhoud in URL's, console, logs, PostHog of browseropslag.
- Klaar = tsc, eslint (max-warnings 0), npm run build en de Playwright-tests van deze feature groen.
- Onduidelijk contract of conflict met de constitution: stop en vraag.
```

---

## J. Taal en navigatie

### J1 · /speckit.specify

```text
Eenduidige Nederlandse UI-taal en navigatie.

Huidige situatie:
- Constitution I schrijft Nederlandse UI-tekst in u-vorm voor, maar de app gebruikt grotendeels de je-vorm ("Beheer je AI assistenten", "Typ je bericht").
- Er staan Engelse termen in de UI: "Roadmap", "runs", "Error", en de rolwaarde "admin"/"member" verschijnt letterlijk in de zijbalk.
- Roadmap staat tussen de werkpagina's in het hoofdmenu.

User stories:
1. (P1) Alle UI-tekst is Nederlands in u-vorm.
2. (P1) Rollen heten overal "Beheerder" en "Adviseur" (zijbalk, Team).
3. (P2) Roadmap staat niet meer in het hoofdmenu maar in het gebruikersblok onderaan de zijbalk, als "Ideeën en wensen".

Acceptatiecriteria:
- Een inventaris van alle gewijzigde teksten (oud → nieuw) staat in de spec-map.
- Geen Engelse woorden in zichtbare UI-tekst, behalve productnamen (Darwin, n8n).
- Playwright-tests die op tekst selecteren zijn bijgewerkt en groen.
- Geen gedragswijzigingen; alleen tekst en menupositie.

Buiten scope: de inhoud van assistentantwoorden, e-mailteksten van Supabase Auth, public/handleiding.html.
```

### J2 · /speckit.plan

```text
Technische route:

1. Inventaris: zoek alle zichtbare tekst in src/ (JSX-tekst, placeholders, aria-labels, toasts, foutmeldingen) en zet die in specs/<deze feature>/copy-inventory.md als tabel: bestand, oud, nieuw. Laat Jaap de inventaris akkoord geven vóór de implementatie.
2. Pas de teksten per bestand aan; geen andere wijzigingen in die bestanden.
3. Eén label-map voor rollen in src/lib/labels.ts, gebruikt in AppShell en TeamPage.
4. AppShell: Roadmap uit navItems; in het gebruikersblok onderaan een link "Ideeën en wensen" naar /roadmap. De route blijft bestaan.
5. Tests: werk bestaande e2e-selectors bij en voeg één test toe die de zijbalk op de nieuwe labels controleert.

Randvoorwaarden:
- Lees eerst AGENTS.md, .specify/memory/constitution.md en alle genoemde bestanden volledig.
- Raak alleen bestanden aan die deze spec nodig heeft; geen refactors ernaast.
- Geen nieuwe npm-dependencies.
- UI-tekst Nederlands in u-vorm; code, identifiers en commits Engels.
- Geen klantinhoud in URL's, console, logs, PostHog of browseropslag.
- Klaar = tsc, eslint (max-warnings 0), npm run build en de Playwright-tests van deze feature groen.
- Onduidelijk contract of conflict met de constitution: stop en vraag.
```

---

## N. n8n (niet via OpenCode)

OpenCode heeft geen n8n-MCP (zie opencode.json). Deze stappen voer je zelf uit in n8n, of laat je Claude uitvoeren via de n8n-koppeling.

| # | Wanneer | Workflow, node | Wijziging |
|---|---|---|---|
| N1 | Nu, los van de frontend | Agentic_RAG_Search 1.5, Qdrant Vector Store | Filter op metadata.kennisbron met match.any op een lijst: eerst gesplitst uit knowledgeSourceName (", "), na A uit knowledge_sources. Lost "assistent met twee kennisbronnen vindt niets" meteen op. |
| N2 | Nu | Agentic RAG Query 1.5, Pre-filter & Query Rewrite | De laatste 3 beurten uit body.conversation.history meegeven en er een zelfstandige vraag van laten maken. Vervolgvragen werken nu niet. |
| N3 | Nu | Agentic RAG Query 1.5, AI Agent (system message) | Voorwaarden ("indien", "mits", "alleen als", "als dit op het polisblad staat") altijd in het antwoord behouden. Bij een vage vraag een wedervraag stellen in plaats van een opsomming. |
| N4 | Nu | Answer Verification, finalresponse | De verifier herschrijft het antwoord niet meer, maar geeft alleen een oordeel. "Wees niet strenger dan nodig" eruit. Expliciet controleren op weggevallen voorwaarden. Een sterker model dan de generator. |
| N5 | Na A | Credential "Darwin auth" | Nieuw token, dat alleen nog in Instellingen wordt ingevoerd. |
| N6 | Na F | finalresponse | De ⚠️- en ❌-tekst niet meer in het antwoord plakken; de UI toont de verificatie. |
| N7 | Na I | RAG documenten laden 1.7 | Bij een fout error_message en status 'error' schrijven in knowledge_base_documents. |
| N8 | Later | Format Reranked Output, finalresponse | Pagina of sectie en chunk-id in sources meegeven. Vereist dat de ingest die vastlegt. |
| N9 | Later | Agentic_RAG_Search 1.5 | De LLM-reranker vervangen door een echte reranker. Tenant en kennisbron op id filteren; dat vereist het opnieuw taggen van de Qdrant-payloads. |
