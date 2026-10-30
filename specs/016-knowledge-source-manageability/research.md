# Research: Kennisbronnenbeheer dat laat zien of een bron bruikbaar is

**Feature**: 016-knowledge-source-manageability | **Date**: 2026-10-30

## 1. Statusupdate bij "Opnieuw verwerken"

**Decision**: De client roept alleen `document-webhook` aan met `action: 'index'`. De edge function zet met de service role `status = 'processing'` en `error_message = null` vóór de n8n-call, en zet bij een upstream-fout de status terug op `error` met de Nederlandse fouttekst.

**Rationale**: `knowledge_base_documents` heeft sinds migratie 015 geen UPDATE-policy; statusovergangen zijn expliciet voorbehouden aan de service role. Een client-side update faalt dus onder RLS, ook voor een admin. De serverroute is al de enige weg naar de ingestflow (feature A) en heeft de service role al. Zo blijft de beveiliging intact en doet de client één aanroep.

**Alternatives considered**:
- Admin-only UPDATE-policy: laat admins via REST ook `name`, `file_path` en andere kolommen wijzigen; te breed.
- SECURITY DEFINER RPC: werkt, maar voegt een tweede schrijfpad toe en laat een document op `processing` staan als de webhook-call daarna mislukt.
- Status in de client zetten: onmogelijk onder de huidige RLS.

**Consequence**: De 009-contractregel "bij uploadfout blijft de status processing" vervalt voor `index`; de status gaat naar `error` met reden, zodat de nieuwe retry-knop precies het herstelpad is. Vastgelegd in `contracts/document-retry.md`.

## 2. Kaartstatistieken: view of RPC

**Decision**: Eén view `public.knowledge_base_stats` met `security_invoker = true`, een LEFT JOIN van `knowledge_bases` naar `knowledge_base_documents`, geaggregeerd per kennisbron.

**Rationale**: De view geeft per kennisbron één rij, ook voor bronnen zonder documenten, en is direct via PostgREST te bevragen. `security_invoker` laat de RLS van de onderliggende tabellen gelden voor de aanroeper, zodat de view geen organisatiegrens omzeilt. Eén query per organisatie voorkomt N+1. De client heeft geen `SECURITY DEFINER`-functie nodig en er komt geen extra RPC-oppervlak bij.

**Alternatives considered**:
- RPC met `SECURITY DEFINER`: krachtiger dan nodig; vereist eigen autorisatielogica en geeft een extra aanvalsoppervlak.
- Aggregatie in de client: N+1 of alle documenten ophalen; schaalt niet.
- Embedden in `knowledge_bases`-select: PostgREST kan geen relatie naar een view infereren zonder extra configuratie.

**Notes**: `count(...)::int` voorkomt int8-serialisatie; `GREATEST(kb.updated_at, COALESCE(MAX(d.updated_at), kb.updated_at))` dekt zowel bron- als documentwijzigingen. `GRANT SELECT ... TO authenticated` is nodig omdat nieuwe views standaard niet aan PostgREST-rollen zijn gegund.

## 3. Polling van documentstatussen

**Decision**: React Query `refetchInterval` in `useKnowledgeBaseDocuments`: 5 000 ms zolang minstens één document `processing` is, anders `false`. `refetchIntervalInBackground: false`.

**Rationale**: Sluit exact aan op de acceptatiecriteria: verversen zolang nodig, stoppen zodra het laatste document klaar is. React Query annuleert het interval bij een nieuwe evaluatie van de functie; geen handmatige timer of `useEffect` nodig. Achtergrondtabbladen verversen niet onnodig.

**Alternatives considered**: Vaste `refetchInterval` (blijft eeuwig pollen), Supabase Realtime (nieuwe afhankelijkheid en kanaalbeheer), handmatige `setInterval` (dubbel beheer, lastiger op te ruimen).

## 4. Migratie en types

**Decision**: Migratie `018_knowledge_source_manageability.sql` voegt `error_message text` toe en maakt de stats-view. `src/types/database.types.ts` wordt handmatig bijgewerkt; daarna `tsc` als controle.

**Rationale**: Het project houdt de types handmatig bij (geen Supabase CLI in de build). De kolom is nullable zodat bestaande rijen en de n8n-flow ongewijzigd blijven. Geen backfill nodig.

**Alternatives considered**: Types genereren via Supabase CLI (niet onderdeel van de toolchain), `error_message` in een aparte tabel (overkill en extra join).

## 5. Meervoudig uploaden

**Decision**: Eén `input multiple` achter een focusbare knop, plus een drop-zone. Bestanden worden sequentieel via de bestaande `uploadDocument` verwerkt; per bestand houdt de pagina een queue-item bij met status `waiting | uploading | done | error`.

**Rationale**: Sequentieel uploaden voorkomt een burst aan gelijktijdige edge-function-calls en maakt voortgang per bestand betrouwbaar zichtbaar. Hergebruik van `uploadDocument` houdt de bestaande typed client, storage-pad en webhook-aanroep intact. Geen nieuwe dependency.

**Alternatives considered**: Parallel met `Promise.all` (moeilijker voortgang/afbreken per bestand, meer gelijktijdige webhook-calls), eigen upload-implementatie (dupliceert bewezen logica).

## 6. Bevestigingsdialog

**Decision**: Hergebruik de bestaande `Dialog` uit `src/components/ui/dialog.tsx` in dezelfde nested-vorm als de bevestiging in `AssistantsPage.tsx` (feature C), lokaal in `KnowledgePage.tsx`.

**Rationale**: Consistente bevestigingservaring, geen nieuwe dependency, geen wijziging aan de gedeelde Dialog. De dialog erft Escape-sluiting; "Annuleren" krijgt autofocus zodat toetsenbordgebruikers direct veilig kunnen annuleren.

**Alternatives considered**: `window.confirm` (niet stylebaar, geen naam-markup, inconsistent), nieuwe algemene ConfirmDialog-component (extra abstractie voor twee aanroepen in hetzelfde bestand).

## 7. Naam vergrendelen

**Decision**: De bewerkmodal leest de documenten van de kennisbron met de bestaande `useKnowledgeBaseDocuments(kb.id)` en disables het naamveld bij `documents.length > 0` of zolang de telling laadt.

**Rationale**: De waarheid is het daadwerkelijke aantal documenten, niet een afgeleide stat uit een mogelijk verouderde kaartquery. De hook gebruikt dezelfde query-key als het detailpaneel, dus delete/upload-invalidaties werken direct door. Bij 0 documenten wordt het veld weer bewerkbaar.

**Alternatives considered**: `document_count` uit de stats-view doorgeven (sneller, maar kan verouderen terwijl de modal open staat), een aparte `head`-countquery (extra query zonder voordeel).

## 8. Toegankelijkheid en UI-taal

**Decision**: Bestand kiezen via een echte `button` die de verborgen file-input opent; de drop-zone is aanvullend en niet de enige route. Statuslijst met `aria-live="polite"`. Bevestiging met autofocus op "Annuleren". Alle nieuwe copy in Nederlands met "u".

**Rationale**: WCAG 2.1 AA vereist toetsenbordoperabiliteit (2.1.1) en waarneembare statusupdates (4.1.3). Een `div` met `onClick` of een `display:none` input is niet focusbaar; een knop wel.

**Alternatives considered**: Alleen een drop-zone (faalt voor toetsenbord), alleen een label om een verborgen input (focusring onduidelijk).

## 9. UI-opschoning zonder dataverlies

**Decision**: Vector Collection ID-veld en Kennisitems-tab worden niet gerenderd; state, payload, hook en databasekolommen blijven staan. `FEATURES.md` krijgt een notitie.

**Rationale**: De opdracht eist behoud van bestaande kolommen en data. Niet renderen is de kleinste wijziging die de belofte ("verwerking van kennisitems") uit de UI haalt zonder data te verwijderen.

**Alternatives considered**: Code verwijderen (verlies van werkende data-toegang en grotere diff), kolom droppen (dataverlies, buiten scope).

## 10. Foutreden tonen

**Decision**: Toon `error_message` als platte tekst onder de "Fout"-badge wanneer gevuld; anders een algemene Nederlandse fouttekst ("De verwerking is mislukt. Probeer het opnieuw of neem contact op met de beheerder.") plus de knop "Opnieuw verwerken".

**Rationale**: De n8n-flow vult de kolom later; de UI mag geen reden verzinnen. React escapet de tekst; er is geen `dangerouslySetInnerHTML`. De kolom zit in dezelfde RLS-beveiligde rij als de documentnaam.

**Alternatives considered**: Foutreden in een toast (verdwijnend, niet persistent bij herladen), foutreden uit de edge-response (niet beschikbaar voor asynchrone n8n-fouten).
