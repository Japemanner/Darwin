# Feature Specification: Kennisbron Documenten — Darwin↔N8N Integratie

**Feature Branch**: `001-knowledge-source-documents`

**Created**: 2026-05-29

**Status**: Draft

**Input**: User description: "de opzet is dat gebruiker onder kennisbronnen documenten toegevoegd. Deze worden via een N8N flow in de vector database gezet. We hebben de volgende requirements:
- de documenten worden vanuit darwin in een supabase storage gezet. Via een webhook wordt de N8N flow geactiveerd. In de json van de webhook zitten de volgende gegevens:
- Tennant ID
- Documentnaam
- documenttype
- download url die 15 minuten geldig is

De kennisbronnen kennen de volgende fucntionaliteit:
- Documenten uploaden
- documenten verwijderen"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Document uploaden naar kennisbron (Priority: P1)

Een gebruiker wil een document (PDF, TXT, DOCX) uploaden naar een kennisbron. Het document wordt opgeslagen in Supabase Storage en er wordt een webhook verstuurd naar N8N met alle gegevens die de N8N-flow nodig heeft om het document te verwerken (inlezen, chunken, embedden in de vector database). Na upload ziet de gebruiker het document in de documentenlijst met de status "Verwerken".

**Why this priority**: Dit is de kernfunctionaliteit — zonder correct werkende upload+webhook kunnen documenten niet worden verwerkt door het N8N-vectoring pipeline.

**Independent Test**: Kan volledig getest worden door een document te uploaden en te verifiëren dat (a) het in Supabase Storage staat, (b) de DB-record is aangemaakt, en (c) de N8N webhook de juiste payload heeft ontvangen.

**Acceptance Scenarios**:

1. **Given** een gebruiker bevindt zich in een kennisbron met de documenten-tab open, **When** de gebruiker selecteert een geldig bestand (PDF, TXT, of DOCX) en uploadt het, **Then** wordt het document opgeslagen in Supabase Storage onder `{orgId}/{kbId}/{uuid}.{ext}`, een record in `knowledge_base_documents` met status `processing` wordt aangemaakt, en een webhook POST naar N8N wordt verstuurd met de payload: `{ tenant_id, document_name, document_type, download_url }`.

2. **Given** een gebruiker uploadt een document, **When** de webhook naar N8N wordt verstuurd, **Then** bevat de `download_url` een gesigneerde Supabase Storage URL die exact 15 minuten geldig is vanaf het moment van aanmaken.

3. **Given** de N8N webhook URL is niet geconfigureerd (ontbreekt in omgevingsvariabelen), **When** een document wordt geüpload, **Then** wordt het document normaal opgeslagen in Storage en DB, maar wordt er géén webhook verstuurd en krijgt de gebruiker hier geen melding van.

4. **Given** een gebruiker probeert een bestand te uploaden dat géén PDF, TXT, of DOCX is, **When** het bestand wordt geselecteerd, **Then** wordt de upload geweigerd met een duidelijke foutmelding over toegestane bestandstypen.

---

### User Story 2 — Document verwijderen uit kennisbron (Priority: P2)

Een gebruiker wil een document permanent verwijderen uit een kennisbron. Het document wordt verwijderd uit Supabase Storage én uit de database. De verwijdering is definitief en onomkeerbaar.

**Why this priority**: Gebruikers moeten foutief geüploade of verouderde documenten kunnen opruimen. Dit is een essentiële beheerfunctie maar minder kritiek dan upload, omdat het geen dataverlies van de primaire flow veroorzaakt.

**Independent Test**: Kan getest worden door een bestaand document te verwijderen en te verifiëren dat het niet meer in Storage staat en niet meer in de documentenlijst verschijnt.

**Acceptance Scenarios**:

1. **Given** een kennisbron bevat minstens één document, **When** de gebruiker klikt op de verwijder-knop naast een document, **Then** wordt het bestand verwijderd uit Supabase Storage, de database-record wordt verwijderd, en het document verdwijnt uit de documentenlijst.

2. **Given** een gebruiker verwijdert een document, **When** de verwijdering is voltooid, **Then** krijgt de gebruiker een bevestigingsmelding ("Document verwijderd").

3. **Given** er treedt een fout op bij het verwijderen van een document uit Storage (bijv. netwerkfout), **When** de verwijderactie faalt, **Then** krijgt de gebruiker een foutmelding en blijft het document zichtbaar in de lijst.

---

### Edge Cases

- **Dubbele bestandsnamen**: Gebruiker uploadt twee bestanden met dezelfde naam naar dezelfde kennisbron → elk document krijgt een unieke UUID in het opslagpad; beide worden correct opgeslagen.
- **Zeer grote bestanden**: Gebruiker uploadt een bestand groter dan de Supabase Storage limiet → upload faalt met duidelijke foutmelding over maximale bestandsgrootte.
- **Gelijktijdige uploads**: Gebruiker start meerdere uploads tegelijk → elke upload wordt onafhankelijk verwerkt; de UI toont per upload de voortgang.
- **Webhook endpoint onbereikbaar**: N8N is tijdelijk offline → document wordt wel opgeslagen in Storage en DB; de webhook call faalt silently (fire-and-forget) maar belemmert de gebruiker niet.
- **Download URL verlopen**: N8N probeert het document te downloaden nadat de 15-minuten URL is verlopen → N8N moet een fallback hebben (dit is een N8N-concern, geen Darwin-concern, maar relevant als integratie-edge case).
- **Lege kennisbron verwijderen**: Gebruiker probeert de kennisbron zelf te verwijderen terwijl er nog documenten in staan → buiten scope van deze feature (behandeld door bestaande functionaliteit).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Systeem MOET bij documentupload een gesigneerde download URL genereren via Supabase Storage die exact 15 minuten geldig is.
- **FR-002**: Systeem MOET bij documentupload een webhook POST naar de N8N webhook URL sturen met de volgende JSON-payload: `tenant_id` (organization_id), `document_name` (bestandsnaam), `document_type` (bestandsextensie, bijv. "pdf"), `download_url` (de 15-minuten gesigneerde URL).
- **FR-003**: Systeem MOET bij documentupload een record in `knowledge_base_documents` aanmaken met status `processing`.
- **FR-004**: Systeem MOET bij documentverwijdering het bestand verwijderen uit Supabase Storage én de bijbehorende database-record verwijderen.
- **FR-005**: Systeem MOET uploads weigeren van bestandstypen die niet in de toegestane lijst staan (PDF, TXT, DOCX) met een gebruikersvriendelijke foutmelding.
- **FR-006**: Systeem MOET bestandsnamen valideren op toegestane karakters en een maximale lengte van 255 karakters.
- **FR-007**: Systeem MOET de webhook fire-and-forget afhandelen — een falende webhook mag de gebruiker niet blokkeren en moet geen foutmelding aan de gebruiker tonen.
- **FR-008**: Systeem MOET een bevestigingsmelding tonen na succesvolle upload ("Document geüpload") en na succesvolle verwijdering ("Document verwijderd").

### Key Entities

- **Knowledge Base (kennisbron)**: Bestaande entiteit. Container voor gerelateerde documenten. Heeft een naam, beschrijving, en behoort tot een organisatie (tenant).
- **Knowledge Base Document**: Een bestand geüpload naar een kennisbron. Heeft een naam, bestandstype (extensie), bestandsgrootte, opslagpad in Supabase Storage, status (`processing` / `ready` / `error`), en een aanmaakdatum.
- **N8N Webhook Payload**: Het JSON-bericht dat Darwin naar N8N stuurt bij documentupload. Bevat: tenant_id, document_name, document_type, download_url (gesigneerd, 15 min geldig).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Gebruikers kunnen een document uploaden en de N8N webhook ontvangt binnen 5 seconden na upload de correcte payload met alle vier de velden (tenant_id, document_name, document_type, download_url).
- **SC-002**: De gesigneerde download URL in de webhook payload is minimaal 14 minuten en maximaal 16 minuten geldig vanaf het moment van genereren.
- **SC-003**: Gebruikers kunnen een document verwijderen en het is binnen 2 seconden niet meer zichtbaar in de interface.
- **SC-004**: 100% van de succesvolle uploads resulteert in een correcte database-record met status `processing`.
- **SC-005**: Uploads van niet-toegestane bestandstypen worden in 100% van de gevallen geweigerd vóórdat er data naar Storage of de database wordt geschreven.

## Assumptions

- De bestaande Supabase Storage bucket `knowledge-documents` en RLS-policies blijven ongewijzigd.
- De N8N webhook URL wordt geconfigureerd via de bestaande omgevingsvariabele `VITE_N8N_DOCUMENT_WEBHOOK`.
- De N8N-flow handelt zelfstandig de statusupdate van `processing` naar `ready` of `error` af (via Supabase service role key).
- De gebruiker heeft een actieve internetverbinding; offline upload-ondersteuning valt buiten scope.
- Bestaande authenticatie (Supabase Auth/PKCE) en autorisatie (RLS) worden hergebruikt.
- Het genereren van gesigneerde URLs vereist dat de Supabase Storage bucket RLS-policies dit toestaan voor geauthenticeerde gebruikers van de eigen organisatie.
- De maximale bestandsgrootte wordt bepaald door de Supabase Storage bucket configuratie (standaard limiet).
- Mobiele ondersteuning is out of scope voor v1.
- Het koppelen/ontkoppelen van assistenten aan kennisbronnen is een aparte feature en valt buiten deze specificatie.
