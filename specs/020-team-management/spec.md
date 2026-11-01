# Feature Specification: Teambeheer: uitnodigen, rol wijzigen en blokkeren

**Feature Branch**: `020-team-management`

**Created**: 2026-10-31

**Status**: Draft

**Input**: User description: "Teambeheer: uitnodigen, rol wijzigen en blokkeren, voor kantoorbeheerders en de platformbeheerder. Huidige situatie: de teampagina toont, alleen voor de rol Beheerder, de profielen van de eigen organisatie en een knop 'Nodig uit'. De uitnodiging maakt een account aan en een koppeling, maar er gaat geen mail uit en de uitgenodigde komt alleen binnen via 'Wachtwoord vergeten'. Openstaande uitnodigingen blijven daardoor altijd leeg en intrekken raakt het aangemaakte account niet. Een teamlid heeft geen e-mailadres in het profiel en een bestaand e-mailadres geeft een fout. Blokkeren of verwijderen kan niet. De app gebruikt een strikte inlogstroom die standaard uitnodigingskoppelingen weigert. Sinds platformbeheer bestaat er een platformbeheerder en heeft Instellingen de tabbladen Assistenten en Nieuwe organisatie. Doel: teams beheren vanuit de app, waarbij elke actie direct en volledig doorwerkt in het account en het profiel. De app is de enige ingang."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Collega uitnodigen en laten activeren (Priority: P1)

Als kantoorbeheerder open ik Team en kies ik "Nodig uit". Ik vul de naam, het
e-mailadres en de rol van mijn collega in: Adviseur of Beheerder. Mijn collega
ontvangt een e-mail van Darwin met een koppeling. Die koppeling opent een
activeringsscherm waarop mijn collega een wachtwoord kiest. Daarna is mijn collega
actief en kan deze inloggen. De nieuwe collega staat vanaf het moment van uitnodigen
in de teamlijst met de status Uitgenodigd.

**Why this priority**: Zonder een uitnodiging die daadwerkelijk per e-mail aankomt en
tot een werkend account leidt, kan niemand tot een team toetreden. Dit is de basis van
alle andere teamacties.

**Independent Test**: Volledig te testen met een kantoorbeheerdersaccount en een nog
onbekend e-mailadres: nodig de collega uit, ontvang de e-mail, open de koppeling in een
andere browser, kies een wachtwoord, log in en controleer dat de status in de teamlijst
van Uitgenodigd naar Actief is gegaan.

**Acceptance Scenarios**:

1. **Given** een kantoorbeheerder op de pagina Team, **When** deze een collega uitnodigt
   met een geldige naam, een geldig en onbekend e-mailadres en de rol Adviseur of
   Beheerder, **Then** ontstaat er een uitnodiging, gaat er een e-mail van Darwin naar
   dat adres en verschijnt de collega direct als Uitgenodigd in de teamlijst met de
   datum van toevoegen.
2. **Given** een uitgenodigde collega die de e-mail heeft ontvangen, **When** deze de
   koppeling opent en een wachtwoord van minimaal acht tekens kiest en bevestigt,
   **Then** is het account actief, staat de status op Actief en kan de collega met dat
   wachtwoord inloggen.
3. **Given** een uitnodiging waarbij het versturen van de e-mail of het aanmaken van het
   account mislukt, **When** de beheerder de actie uitvoert, **Then** blijven er geen
   account, profiel of uitnodiging achter en verschijnt een zichtbare Nederlandse
   foutmelding.
4. **Given** een e-mailadres dat al bij een andere organisatie hoort, **When** de
   beheerder dit adres uitnodigt, **Then** verschijnt "Dit e-mailadres hoort al bij een
   andere organisatie.", gaat er geen e-mail uit en wijzigt er niets.
5. **Given** een e-mailadres dat al in het eigen team staat, in welke status dan ook,
   **When** de beheerder dit adres uitnodigt, **Then** verschijnt "Deze persoon staat al
   in het team.", gaat er geen e-mail uit en wijzigt er niets.
6. **Given** een lege naam, een ongeldig e-mailadres of een andere rol dan Adviseur of
   Beheerder, **When** de beheerder de uitnodiging verstuurt, **Then** weigert het
   systeem de actie met een Nederlandse melding en wordt er niets aangemaakt.

---

### User Story 2 - Teamoverzicht met naam, e-mailadres, rol, status en datum (Priority: P1)

Als kantoorbeheerder zie ik op Team één overzicht van mijn team. Per teamlid zie ik de
naam, het e-mailadres, de rol (Adviseur of Beheerder), de status (Uitgenodigd, Actief of
Geblokkeerd) en de datum van toevoegen. Uitgenodigde en geblokkeerde teamleden blijven
in het overzicht staan, zodat ik altijd zie wie er bij mijn organisatie hoort.

**Why this priority**: Zonder een betrouwbaar overzicht kan een beheerder niet zien wie
toegang heeft, wie nog moet activeren en wie geblokkeerd is. Elke andere teamactie
vertrekt vanuit dit overzicht.

**Independent Test**: Volledig te testen met een organisatie met één actief teamlid, één
uitgenodigd teamlid en één geblokkeerd teamlid: open Team en controleer dat alle drie
met de juiste naam, het juiste e-mailadres, de juiste rol, de juiste status en de juiste
datum worden getoond.

**Acceptance Scenarios**:

1. **Given** een organisatie met actieve, uitgenodigde en geblokkeerde teamleden,
   **When** een kantoorbeheerder Team opent, **Then** toont elk teamlid naam,
   e-mailadres, rol, status en datum van toevoegen.
2. **Given** een uitgenodigd teamlid, **When** deze de uitnodiging accepteert, **Then**
   blijft de rij staan, wijzigt alleen de status naar Actief en blijft de datum van
   toevoegen gelijk.
3. **Given** een actief teamlid dat wordt geblokkeerd, **When** de beheerder het
   overzicht herlaadt, **Then** staat het teamlid er nog steeds met de status
   Geblokkeerd.
4. **Given** een organisatie zonder teamleden, **When** de beheerder Team opent,
   **Then** verschijnt een Nederlandse lege toestand met de mogelijkheid om een collega
   uit te nodigen.
5. **Given** een kantoorbeheerder, **When** deze Team opent, **Then** ziet deze
   uitsluitend teamleden van de eigen organisatie en geen enkel gegeven van een andere
   organisatie.

---

### User Story 3 - Uitnodiging opnieuw versturen of intrekken (Priority: P1)

Als kantoorbeheerder kan ik een uitnodiging opnieuw versturen zolang mijn collega de
koppeling nog niet heeft gebruikt. De oude koppeling vervalt daarmee direct en de nieuwe
is weer 24 uur geldig. Ik kan de uitnodiging ook intrekken; dan verdwijnt de collega uit
de teamlijst en komt het e-mailadres weer vrij voor een nieuwe uitnodiging.

**Why this priority**: Een uitnodiging kan verlopen, in de spam belanden of naar het
verkeerde adres gaan. Zonder opnieuw versturen en intrekken blijft een foutieve
uitnodiging voor altijd staan en blijft een e-mailadres onnodig bezet.

**Independent Test**: Volledig te testen met een uitgenodigd teamlid: verstuur de
uitnodiging opnieuw en controleer dat de oude koppeling niet meer werkt en de nieuwe wel;
trek daarna een tweede uitnodiging in en controleer dat de rij verdwijnt en hetzelfde
adres opnieuw kan worden uitgenodigd.

**Acceptance Scenarios**:

1. **Given** een teamlid met status Uitgenodigd, **When** de beheerder de uitnodiging
   opnieuw verstuurt, **Then** ontvangt de collega een nieuwe e-mail, is de vorige
   koppeling direct ongeldig en geldt de nieuwe koppeling 24 uur vanaf het opnieuw
   versturen.
2. **Given** een oude koppeling die nog in een browser openstaat, **When** de beheerder
   de uitnodiging opnieuw heeft verstuurd en de collega de oude koppeling gebruikt,
   **Then** verschijnt "Deze uitnodigingslink is verlopen of al gebruikt. Vraag uw
   beheerder om een nieuwe uitnodiging." en wordt er niets geactiveerd.
3. **Given** een teamlid met status Uitgenodigd, **When** de beheerder de uitnodiging
   intrekt, **Then** verdwijnen de openstaande uitnodiging en het nog niet gebruikte
   account, is de koppeling direct ongeldig, verdwijnt de rij uit het overzicht en kan
   hetzelfde e-mailadres opnieuw worden uitgenodigd.
4. **Given** een teamlid met status Actief of Geblokkeerd, **When** de beheerder de
   uitnodiging probeert in te trekken, **Then** weigert het systeem dit met een
   Nederlandse melding en wijzigt er niets.
5. **Given** een mislukte poging om opnieuw te versturen, **When** de actie afbreekt,
   **Then** blijft de bestaande koppeling geldig en verschijnt een Nederlandse
   foutmelding.
6. **Given** een mislukte poging om in te trekken, **When** de actie afbreekt, **Then**
   blijven de uitnodiging en het account bestaan en verschijnt een Nederlandse
   foutmelding.

---

### User Story 4 - Rol wijzigen, blokkeren en deblokkeren (Priority: P1)

Als kantoorbeheerder wijzig ik de rol van een teamlid tussen Adviseur en Beheerder. Ik
kan een actief teamlid blokkeren; diegene kan dan niet meer inloggen en verliest direct de
toegang tot alle gegevens, ook in een sessie die al openstaat. Ik kan een geblokkeerd
teamlid weer deblokkeren; diegene logt dan in met het bestaande wachtwoord en ziet alles
terug. Gesprekken, assistenten en kennisbronnen van die persoon blijven bestaan.

**Why this priority**: Rolwijziging en blokkade zijn de enige manier om toegang binnen een
team te corrigeren zonder gegevens te verwijderen. Zonder deze acties blijft een
vertrekkende of verkeerd geplaatste collega voor altijd actief.

**Independent Test**: Volledig te testen met een actief teamlid: wijzig de rol en
controleer de nieuwe rechten, blokkeer het teamlid en controleer dat een bestaand gesprek
en de bijbehorende gegevens niet meer bereikbaar zijn, deblokkeer en controleer dat
inloggen met het oude wachtwoord weer lukt en de gegevens terug zijn.

**Acceptance Scenarios**:

1. **Given** een actief teamlid met de rol Adviseur, **When** de beheerder de rol wijzigt
   naar Beheerder, **Then** toont het overzicht direct Beheerder en gelden de
   beheerrechten vanaf het eerstvolgende verzoek van dat teamlid.
2. **Given** een actief teamlid, **When** de beheerder het teamlid blokkeert, **Then**
   staat de status direct op Geblokkeerd, kan het teamlid niet meer inloggen en krijgt
   elk volgend verzoek van dat teamlid geen gegevens meer.
3. **Given** een teamlid met een sessie die al openstaat, **When** de beheerder het
   teamlid blokkeert en het teamlid daarna een volgende handeling uitvoert, **Then**
   krijgt het teamlid geen gegevens meer, ziet het de Nederlandse blokkademelding en wordt
   het uitgelogd.
4. **Given** een geblokkeerd teamlid, **When** de beheerder het teamlid deblokkeert,
   **Then** staat de status op Actief, kan het teamlid inloggen met het bestaande
   wachtwoord en ziet het al zijn gesprekken, assistenten en kennisbronnen terug.
5. **Given** een teamlid met gesprekken, assistenten of kennisbronnen, **When** dit
   teamlid wordt geblokkeerd, **Then** blijven die gegevens bestaan en blijven ze voor de
   overige bevoegde teamleden volgens de bestaande regels zichtbaar.
6. **Given** een teamlid met status Uitgenodigd, **When** de beheerder de rol wijzigt,
   **Then** geldt de nieuwe rol vanaf de activering en blijft de status Uitgenodigd.
7. **Given** een mislukte rolwijziging of blokkade, **When** de actie afbreekt, **Then**
   blijven de oude rol en status staan en verschijnt een Nederlandse foutmelding.

---

### User Story 5 - Platformbeheerder beheert elk team via Instellingen (Priority: P1)

Als platformbeheerder open ik Instellingen en kies ik het tabblad Team. Daar kies ik een
organisatie en zie ik het team van die organisatie. Ik kan daar alles doen uit de vorige
verhalen: uitnodigen, opnieuw versturen, intrekken, de rol wijzigen, blokkeren en
deblokkeren.

**Why this priority**: De platformbeheerder is de enige die alle organisaties kan
ondersteunen. Zonder dit tabblad moet elke teamwijziging buiten de app gebeuren, terwijl
de app de enige ingang moet zijn.

**Independent Test**: Volledig te testen met een platformbeheerdersaccount en twee
organisaties: kies de ene organisatie, nodig daar een collega uit en blokkeer een teamlid;
kies daarna de andere organisatie en controleer dat het overzicht en de acties bij die
organisatie horen.

**Acceptance Scenarios**:

1. **Given** een platformbeheerder in Instellingen, **When** deze Instellingen opent,
   **Then** ziet deze een tabblad Team naast de bestaande tabbladen.
2. **Given** een platformbeheerder op het tabblad Team, **When** deze een organisatie
   kiest, **Then** ziet deze het team van die organisatie met naam, e-mailadres, rol,
   status en datum van toevoegen.
3. **Given** een gekozen organisatie, **When** de platformbeheerder een collega uitnodigt,
   een rol wijzigt, blokkeert, deblokkeert, opnieuw verstuurt of intrekt, **Then** geldt
   de actie voor die organisatie en niet voor de eigen organisatie van de
   platformbeheerder.
4. **Given** een kantoorbeheerder, **When** deze Instellingen opent, **Then** is het
   tabblad Team niet zichtbaar en niet bereikbaar.
5. **Given** een adviseur, **When** deze de applicatie gebruikt, **Then** is er geen
   teambeheer zichtbaar of bereikbaar.

---

### User Story 6 - Waarborgen tegen uitsluiting en machtsmisbruik (Priority: P1)

Als beheerder kan ik mijn eigen account niet blokkeren en mijn eigen rol niet wijzigen.
Niemand kan de laatste actieve beheerder van een organisatie blokkeren of tot adviseur
maken. Een kantoorbeheerder kan een platformbeheerder niet blokkeren en diens rol niet
wijzigen. Zo kan een team of het platform zichzelf nooit buitensluiten.

**Why this priority**: Zonder deze waarborgen kan één verkeerde klik een organisatie
zonder beheerder achterlaten of de platformbeheerder buitensluiten. Herstel zou dan
buiten de app moeten gebeuren, wat indruist tegen het doel van deze feature.

**Independent Test**: Volledig te testen met twee beheerders in één organisatie, een
platformbeheerder en een adviseur: probeer alle verboden acties en controleer dat elke
actie wordt geweigerd met een Nederlandse melding en dat er niets wijzigt.

**Acceptance Scenarios**:

1. **Given** een beheerder, **When** deze het eigen account probeert te blokkeren,
   **Then** weigert het systeem dit met een Nederlandse melding.
2. **Given** een beheerder, **When** deze de eigen rol probeert te wijzigen, **Then**
   weigert het systeem dit met een Nederlandse melding.
3. **Given** een organisatie met één actieve beheerder, **When** iemand deze beheerder
   probeert te blokkeren, **Then** weigert het systeem dit met een Nederlandse melding.
4. **Given** een organisatie met één actieve beheerder, **When** iemand deze beheerder
   probeert te degraderen naar Adviseur, **Then** weigert het systeem dit met een
   Nederlandse melding.
5. **Given** een platformbeheerder die tevens lid is van de organisatie van een
   kantoorbeheerder, **When** de kantoorbeheerder de platformbeheerder probeert te
   blokkeren, **Then** weigert het systeem dit met een Nederlandse melding.
6. **Given** dezelfde situatie, **When** de kantoorbeheerder de rol van de
   platformbeheerder probeert te wijzigen, **Then** weigert het systeem dit met een
   Nederlandse melding.
7. **Given** twee actieve beheerders in één organisatie, **When** de één de ander
   blokkeert en daarna de laatste actieve beheerder probeert te blokkeren, **Then** lukt
   de eerste blokkade en wordt de tweede geweigerd.
8. **Given** een uitgenodigde beheerder die nog niet is geactiveerd, **When** de enige
   actieve beheerder wordt geblokkeerd, **Then** telt de uitgenodigde beheerder niet als
   actieve beheerder en wordt de blokkade geweigerd.
9. **Given** een platformbeheerder, **When** deze de laatste actieve beheerder van een
   organisatie probeert te blokkeren of te degraderen, **Then** weigert het systeem dit
   met een Nederlandse melding.

---

### User Story 7 - Geblokkeerde gebruiker ziet een Nederlandse melding (Priority: P1)

Als geblokkeerd teamlid zie ik een Nederlandse melding dat mijn account geblokkeerd is.
Dat gebeurt zowel wanneer ik probeer in te loggen als wanneer ik nog een sessie heb die
al openstaat. Ik word uitgelogd en krijg geen gegevens meer te zien. Na deblokkeren kan ik
weer inloggen met mijn bestaande wachtwoord en zie ik alles terug.

**Why this priority**: Een blokkade is alleen geloofwaardig als de gebruiker begrijpt
waarom de toegang stopt. Een technische of Engelse foutmelding zou de gebruiker laten
denken dat er iets stuk is.

**Independent Test**: Volledig te testen met een geblokkeerd teamlid: probeer in te
loggen en controleer de melding; houd een sessie open, blokkeer het teamlid en voer een
volgende handeling uit; controleer de melding en het uitloggen; deblokkeer en controleer
dat inloggen met het oude wachtwoord weer lukt.

**Acceptance Scenarios**:

1. **Given** een geblokkeerd teamlid op de inlogpagina, **When** deze met het juiste
   wachtwoord probeert in te loggen, **Then** verschijnt "Uw account is geblokkeerd. Neem
   contact op met uw beheerder." en ontstaat er geen sessie.
2. **Given** een teamlid met een sessie die al openstaat, **When** dit teamlid wordt
   geblokkeerd en daarna een volgende handeling uitvoert, **Then** verschijnt dezelfde
   Nederlandse melding, wordt het teamlid uitgelogd en worden er geen gegevens meer
   getoond.
3. **Given** een geblokkeerd teamlid, **When** de beheerder het teamlid deblokkeert,
   **Then** kan het teamlid inloggen met het bestaande wachtwoord en ziet het alle
   eerdere gegevens terug.
4. **Given** de blokkademelding, **When** een toetsenbordgebruiker of schermlezer de
   pagina gebruikt, **Then** is de melding zichtbaar, voorleesbaar en niet alleen met
   kleur aangeduid.

---

### User Story 8 - De server dwingt alle rechten en waarborgen af (Priority: P1)

De server dwingt alle regels af, ook als iemand de gebruikersinterface omzeilt. Een
adviseur krijgt bij elke teamactie een weigering. Een kantoorbeheerder krijgt een
weigering voor elke organisatie behalve de eigen. De waarborgen uit verhaal 6 gelden ook
bij rechtstreekse aanroepen. Een geblokkeerd teamlid krijgt geen gegevens en geen enkele
teamactie meer.

**Why this priority**: UI-maatregelen zijn te omzeilen. Alleen afdwinging op de server
maakt van de regels echte beveiliging in plaats van knoppen die verborgen zijn.

**Independent Test**: Volledig te testen met rechtstreekse aanroepen buiten de
gebruikersinterface onder een adviseursaccount, een kantoorbeheerdersaccount, een
platformbeheerdersaccount en een geblokkeerd account: controleer per actie de weigering
of toelating en controleer dat er niets wijzigt bij een weigering.

**Acceptance Scenarios**:

1. **Given** een adviseur, **When** deze buiten de gebruikersinterface om een teamactie
   uitvoert, **Then** weigert de server de actie en wijzigt er niets.
2. **Given** een kantoorbeheerder, **When** deze buiten de gebruikersinterface om een
   teamactie voor een andere organisatie uitvoert, **Then** weigert de server de actie en
   wijzigt er niets.
3. **Given** een niet-ingelogde gebruiker, **When** deze een teamactie probeert uit te
   voeren, **Then** weigert de server de actie.
4. **Given** een geblokkeerd teamlid, **When** deze met het bestaande token een
   gegevensverzoek of teamactie uitvoert, **Then** krijgt deze geen gegevens en weigert de
   server de teamactie.
5. **Given** een gebruiker die zijn eigen status, rol of e-mailadres rechtstreeks
   probeert te wijzigen, **When** de server het verzoek ontvangt, **Then** weigert de
   server dit en wijzigt er niets.
6. **Given** een rechtstreekse poging om de eigen account te blokkeren, de laatste actieve
   beheerder te blokkeren of een platformbeheerder te blokkeren, **When** de server het
   verzoek ontvangt, **Then** weigert de server dit met dezelfde waarborg als in de
   gebruikersinterface.
7. **Given** een teamactie met een ongeldige rol, een ongeldige statusovergang of een
   ontbrekend verplicht veld, **When** de server het verzoek ontvangt, **Then** weigert de
   server dit en wijzigt er niets.

---

### User Story 9 - Bestaande gebruikers merken niets van de migratie (Priority: P1)

Als bestaand teamlid log ik na de invoering van teambeheer in zoals altijd. Mijn rol, mijn
gegevens en mijn toegang zijn ongewijzigd; ik hoef niet opnieuw in te loggen en zie geen
nieuwe blokkade of uitnodiging. Elke bestaande organisatie houdt minimaal één actieve
beheerder.

**Why this priority**: De nieuwe status- en teamgegevens mogen bestaande toegang niet
veranderen. Een migratie die gebruikers buitensluit of gegevens verbergt, is een storing.

**Independent Test**: Volledig te testen met bestaande accounts in meerdere organisaties:
log voor en na de migratie in, vergelijk rol, gegevens en toegang, controleer dat niemand
opnieuw hoeft in te loggen en dat elke organisatie een actieve beheerder heeft.

**Acceptance Scenarios**:

1. **Given** een bestaand actief teamlid, **When** deze na de migratie de applicatie
   gebruikt, **Then** is de status Actief, blijven rol en gegevens gelijk, hoeft het
   teamlid niet opnieuw in te loggen en is er geen zichtbare verandering.
2. **Given** een bestaande organisatie met één of meer beheerders, **When** de migratie
   voltooit, **Then** blijft er minimaal één actieve beheerder over en behouden alle andere
   teamleden hun rol.
3. **Given** een bestaande organisatie zonder actieve beheerder, **When** de migratie
   wordt uitgevoerd, **Then** stopt de ingebruikname met een expliciete Nederlandse melding
   in plaats van de organisatie zonder beheerder achter te laten.
4. **Given** bestaande gesprekken, assistenten en kennisbronnen, **When** de migratie
   voltooit, **Then** blijven ze voor dezelfde bevoegde gebruikers zichtbaar.

---

### Edge Cases

- **Uitnodigen met het eigen e-mailadres**: het adres staat al in het eigen team, dus
  verschijnt "Deze persoon staat al in het team." en gaat er geen e-mail uit.
- **E-mailadres van een geblokkeerd teamlid**: dit staat al in het eigen team; de
  uitnodiging wordt geweigerd met dezelfde melding.
- **E-mailadres met andere hoofdletters of spaties**: het adres wordt als hetzelfde adres
  behandeld; er ontstaat geen tweede account.
- **Oude koppeling nog open in een browser**: na opnieuw versturen of intrekken werkt de
  oude koppeling niet meer en verschijnt de melding over een verlopen of gebruikte
  koppeling.
- **Koppeling twee keer geopend**: de tweede keer verschijnt dezelfde melding en wordt er
  niets opnieuw geactiveerd.
- **Koppeling na 24 uur**: de koppeling is verlopen en de melding vraagt om een nieuwe
  uitnodiging.
- **Koppeling op een ander apparaat of in een andere browser**: de activering werkt, omdat
  de koppeling niet aan een browser of apparaat is gebonden.
- **Uitnodiging intrekken terwijl de collega al een wachtwoord heeft gekozen**: dit is
  geen openstaande uitnodiging meer; intrekken wordt geweigerd en de beheerder kan het
  teamlid blokkeren.
- **Blokkeren van een nog niet geactiveerd teamlid**: dit kan niet; de beheerder trekt de
  uitnodiging in.
- **Twee beheerders blokkeren elkaar op hetzelfde moment**: de server staat maximaal één
  actie toe die de laatste actieve beheerder zou verwijderen; de andere actie wordt
  geweigerd.
- **Laatste actieve beheerder is ook platformbeheerder**: de waarborg tegen het
  blokkeren van de laatste actieve beheerder gaat voor.
- **Geblokkeerde beheerder had openstaande uitnodigingen**: die uitnodigingen blijven
  geldig tot ze verlopen en kunnen door een andere beheerder worden ingetrokken.
- **E-mail versturen mislukt nadat het account is aangemaakt**: het account wordt
  teruggedraaid en er blijft geen rij in de teamlijst achter.
- **Profiel opslaan mislukt nadat het account is aangemaakt**: het account wordt
  teruggedraaid; er ontstaat geen account zonder profiel.
- **Rolwijziging mislukt halverwege**: de oude rol blijft staan en de beheerder ziet een
  Nederlandse foutmelding.
- **Deblokkeren mislukt**: het teamlid blijft geblokkeerd en de beheerder ziet een
  Nederlandse foutmelding.
- **Geblokkeerd teamlid met een pushmelding of achtergrondverzoek**: het verzoek levert
  geen gegevens op en de toegang blijft geweigerd.
- **Organisatie zonder actieve beheerder bij de ingebruikname**: de feature gaat niet
  live voordat dit is hersteld; de ingebruikname meldt dit expliciet.
- **Teamlid wijzigt zijn eigen e-mailadres of status via een rechtstreekse aanroep**: de
  server weigert dit.
- **Naam of e-mailadres van een teamlid wijzigen**: dit is buiten scope en komt niet in
  de interface.

## Requirements *(mandatory)*

### Functional Requirements

**Uitnodigen en activeren**

- **FR-001**: Een kantoorbeheerder MOET op de pagina Team een collega kunnen uitnodigen
  met een naam, een e-mailadres en een rol: Adviseur of Beheerder. Een platformbeheerder
  MOET dezelfde actie kunnen uitvoeren voor een gekozen organisatie op het tabblad Team
  in Instellingen.
- **FR-002**: Na een geslaagde uitnodiging MOET de collega een e-mail van Darwin
  ontvangen met een eenmalige koppeling die 24 uur geldig is. De e-mail MOET in het
  Nederlands zijn, de organisatienaam, de rol en de geldigheidsduur noemen en verwijzen
  naar het activeringsscherm.
- **FR-003**: De koppeling MOET een activeringsscherm openen waarop de collega een
  wachtwoord van minimaal acht tekens kiest en bevestigt. Na opslaan MOET het account
  actief zijn en MOET de collega met dat wachtwoord kunnen inloggen.
- **FR-004**: De eenmalige koppeling MOET na activering ongeldig zijn. Een verlopen of
  gebruikte koppeling MOET "Deze uitnodigingslink is verlopen of al gebruikt. Vraag uw
  beheerder om een nieuwe uitnodiging." tonen en MOET niets activeren.
- **FR-005**: De eenmalige token uit de uitnodigingskoppeling MAG niet in analytische
  gegevens, logbestanden of browseropslag terechtkomen, ook niet via een omleiding naar
  de inlogpagina. De token MOET direct na gebruik uit de adresbalk verdwijnen.
- **FR-006**: Een e-mailadres dat al bij een andere organisatie hoort, MOET de melding
  "Dit e-mailadres hoort al bij een andere organisatie." geven. Er MAG dan geen e-mail
  uitgaan en er MAG niets worden aangemaakt of gewijzigd.
- **FR-007**: Een e-mailadres dat al in het eigen team staat, in welke status dan ook,
  MOET de melding "Deze persoon staat al in het team." geven. Er MAG dan geen e-mail
  uitgaan en er MAG niets worden aangemaakt of gewijzigd.
- **FR-008**: E-mailadressen MOETEN hoofdletterongevoelig en zonder voorloop- of
  volgspaties worden vergeleken, zodat hetzelfde adres nooit twee accounts oplevert.
- **FR-009**: Een lege naam, een ongeldig e-mailadres of een rol buiten Adviseur en
  Beheerder MOET worden geweigerd met een zichtbare Nederlandse melding; er MAG niets
  worden aangemaakt.
- **FR-010**: Een nieuwe uitnodiging MOET direct als Uitgenodigd in de teamlijst staan,
  met de datum van toevoegen. Na activering MOET de status Actief zijn en MOET de datum
  van toevoegen gelijk blijven.

**Teamoverzicht**

- **FR-011**: Het teamoverzicht MOET per teamlid naam, e-mailadres, rol, status en datum
  van toevoegen tonen. De status MOET een van de volgende drie waarden zijn: Uitgenodigd,
  Actief of Geblokkeerd.
- **FR-012**: Een uitgenodigd teamlid MOET als Uitgenodigd zichtbaar zijn tot het een
  wachtwoord heeft gekozen. Een teamlid dat een wachtwoord heeft gekozen en niet is
  geblokkeerd, MOET Actief zijn. Een geblokkeerd teamlid MOET Geblokkeerd zijn.
- **FR-013**: Een kantoorbeheerder MOET uitsluitend de teamleden van de eigen organisatie
  zien. Een platformbeheerder MOET de teamleden van de gekozen organisatie zien en geen
  gegevens van een andere organisatie door elkaar tonen.
- **FR-014**: Een organisatie zonder teamleden MOET een Nederlandse lege toestand tonen
  met de mogelijkheid om een collega uit te nodigen.
- **FR-015**: Na elke geslaagde teamactie MOET het overzicht de nieuwe situatie tonen —
  een nieuw teamlid, een gewijzigde rol of een gewijzigde status — zonder dat de gebruiker
  de pagina handmatig hoeft te herladen.

**Opnieuw versturen en intrekken**

- **FR-016**: Een beheerder MOET een uitnodiging opnieuw kunnen versturen zolang de
  status Uitgenodigd is. Daarbij MOET de vorige koppeling direct ongeldig worden, MOET er
  een nieuwe e-mail uitgaan die de actuele rol noemt, MOET de geldigheidsduur opnieuw
  24 uur zijn en MAG er geen tweede teamlid of account ontstaan.
- **FR-017**: Een beheerder MOET een uitnodiging met status Uitgenodigd kunnen intrekken.
  Daarbij MOET de uitnodiging niet meer als openstaand gelden, MOET het nog niet gebruikte
  account verdwijnen, MOET de koppeling direct ongeldig worden, MOET de rij uit het
  overzicht verdwijnen en MOET het e-mailadres opnieuw kunnen worden uitgenodigd.
- **FR-018**: Intrekken MOET worden geweigerd voor een teamlid met status Actief of
  Geblokkeerd, met een Nederlandse melding die uitlegt dat het teamlid kan worden
  geblokkeerd.
- **FR-019**: Mislukt opnieuw versturen, dan MOET de bestaande koppeling geldig blijven.
  Mislukt intrekken, dan MOETEN de uitnodiging en het account blijven bestaan. In beide
  gevallen MOET een zichtbare Nederlandse foutmelding verschijnen.

**Rol wijzigen**

- **FR-020**: Een beheerder MOET de rol van een teamlid in de eigen organisatie kunnen
  wijzigen tussen Adviseur en Beheerder. Een platformbeheerder MOET dit voor elke
  organisatie kunnen doen.
- **FR-021**: Een rolwijziging MOET vanaf het eerstvolgende verzoek van het teamlid
  gelden. Van een nog niet geactiveerd teamlid MOET de nieuwe rol bij activering gelden.
- **FR-022**: Niemand MAG de eigen rol wijzigen; de server MOET dit weigeren met een
  Nederlandse melding.
- **FR-023**: De laatste actieve beheerder van een organisatie MAG niet tot Adviseur
  worden gemaakt; de server MOET dit weigeren met een Nederlandse melding.
- **FR-024**: Een kantoorbeheerder MAG de rol van een platformbeheerder niet wijzigen; de
  server MOET dit weigeren met een Nederlandse melding.

**Blokkeren en deblokkeren**

- **FR-025**: Een beheerder MOET een actief teamlid kunnen blokkeren. Daarna MOET de
  status Geblokkeerd zijn en MAG het teamlid niet meer kunnen inloggen.
- **FR-026**: Blokkeren MOET alle bestaande sessies van het teamlid direct ongeldig maken.
  Vanaf het eerstvolgende verzoek MAG het teamlid geen gegevens meer ontvangen en MOET
  elke teamactie worden geweigerd.
- **FR-027**: Bij blokkeren MOETEN gesprekken, assistenten en kennisbronnen van het
  teamlid blijven bestaan en MOETEN ze voor de overige bevoegde teamleden volgens de
  bestaande regels zichtbaar blijven.
- **FR-028**: De laatste actieve beheerder van een organisatie MAG niet worden
  geblokkeerd; de server MOET dit weigeren met een Nederlandse melding.
- **FR-029**: Een kantoorbeheerder MAG een platformbeheerder niet blokkeren; de server
  MOET dit weigeren met een Nederlandse melding.
- **FR-030**: Niemand MAG het eigen account blokkeren; de server MOET dit weigeren met een
  Nederlandse melding.
- **FR-031**: Blokkeren van een teamlid met status Uitgenodigd MOET worden geweigerd met
  een Nederlandse melding die verwijst naar het intrekken van de uitnodiging.
- **FR-032**: Een beheerder MOET een geblokkeerd teamlid kunnen deblokkeren. Daarna MOET
  de status Actief zijn, MOET de bestaande rol behouden blijven, MOET het bestaande
  wachtwoord werken en MOET het teamlid al zijn eerdere gegevens terugzien.
- **FR-033**: Een geblokkeerd teamlid MOET bij een inlogpoging en bij een volgend verzoek
  in een openstaande sessie de melding "Uw account is geblokkeerd. Neem contact op met uw
  beheerder." zien, MOET worden uitgelogd en MAG geen gegevens meer ontvangen.

**Consistentie en foutafhandeling**

- **FR-034**: Elke teamactie MOET alles-of-niets zijn. Mislukt een stap, dan MOETEN alle
  eerdere stappen van die actie worden teruggedraaid. Er MAG geen account zonder profiel,
  geen profiel zonder account en geen openstaande uitnodiging zonder bijbehorend account
  ontstaan.
- **FR-035**: Elke fout MOET een zichtbare Nederlandse melding opleveren. Stil falen is
  niet toegestaan.
- **FR-036**: Alle teamacties (uitnodigen, opnieuw versturen, intrekken, rol wijzigen,
  blokkeren en deblokkeren) MOETEN via één beveiligde beheerroute op de server verlopen.
- **FR-037**: De server MOET een adviseur bij elke teamactie weigeren, een
  kantoorbeheerder bij elke organisatie behalve de eigen, een niet-ingelogde gebruiker
  altijd, en een geblokkeerd teamlid bij elke teamactie.
- **FR-038**: De server MOET alle waarborgen uit FR-022, FR-023, FR-024, FR-028, FR-029 en
  FR-030 ook afdwingen bij rechtstreekse aanroepen buiten de gebruikersinterface.
- **FR-039**: Een gebruiker MAG zijn eigen status, rol en e-mailadres niet kunnen wijzigen
  via rechtstreekse aanroepen; de server MOET dit weigeren en er MAG niets wijzigen.
- **FR-040**: Een teamactie met een ongeldige rol, een ongeldige statusovergang of een
  ontbrekend verplicht veld MOET door de server worden geweigerd zonder wijzigingen.

**Toegang en schermen**

- **FR-041**: Een kantoorbeheerder MOET de pagina Team kunnen openen en beheren. Een
  adviseur MAG geen Team in het menu zien, MAG de pagina niet kunnen openen en MAG geen
  teamactie kunnen uitvoeren.
- **FR-042**: Alleen een platformbeheerder MOET in Instellingen een tabblad Team zien.
  Daar MOET deze een organisatie kunnen kiezen en het team van die organisatie beheren.
  Een kantoorbeheerder of adviseur MAG dit tabblad niet zien of bereiken.
- **FR-043**: Alle nieuwe en gewijzigde interfaceteksten op de teampagina en het tabblad
  Team MOETEN Nederlands in de u-vorm zijn, inclusief de lege toestand, de knoppen, de
  bevestigingen en de foutmeldingen.
- **FR-044**: Alle teamacties MOETEN met het toetsenbord bereikbaar en bedienbaar zijn.
  Knoppen met alleen een icoon MOETEN een Nederlandse toegankelijke naam hebben.
  Dialoogvensters MOETEN de focus vasthouden en met het toetsenbord te sluiten zijn.
- **FR-045**: Status MOET niet uitsluitend met kleur worden aangeduid; de status MOET ook
  als tekst zichtbaar en voorleesbaar zijn.

**Migratie en bestaande situatie**

- **FR-046**: Bestaande gebruikers MOETEN na de migratie de status Actief hebben, hun
  huidige rol en gegevens behouden en zonder opnieuw in te loggen precies hetzelfde zien
  als voorheen.
- **FR-047**: Elke bestaande organisatie MOET na de migratie minimaal één actieve
  beheerder hebben. Is dat niet zo, dan MOET de ingebruikname dit expliciet melden en
  stoppen in plaats van een organisatie zonder beheerder achter te laten.
- **FR-048**: Een teamlid MOET altijd een e-mailadres hebben dat zichtbaar is in het
  teamoverzicht. Het e-mailadres van een teamlid MAG in deze feature niet worden gewijzigd.
- **FR-049**: Naam en e-mailadres MOETEN afzonderlijke gegevens zijn. Het e-mailadres MAG
  niet als naam worden opgeslagen en de naam MAG niet als e-mailadres worden gebruikt.

### Key Entities *(include if feature involves data)*

- **Teamlid**: persoon binnen één organisatie met een naam, een e-mailadres, een rol
  (Adviseur of Beheerder), een status (Uitgenodigd, Actief of Geblokkeerd) en een datum
  van toevoegen. Een teamlid hoort bij precies één organisatie en heeft precies één
  account en één profiel.
- **Uitnodiging**: openstaande toelating voor één e-mailadres tot één organisatie, met
  een naam, een rol, de uitnodigende beheerder, de datum van verzenden en een eenmalige
  koppeling die 24 uur geldig is. Een uitnodiging is open, gebruikt, ingetrokken of
  verlopen.
- **Account en profiel**: het inlogaccount en het bijbehorende profiel van een teamlid.
  Beide ontstaan en verdwijnen samen; een teamactie laat nooit een account zonder profiel
  of een profiel zonder account achter.
- **Organisatie**: tenant met eigen teamleden, gesprekken, assistenten en kennisbronnen.
  Een organisatie heeft altijd minimaal één actieve beheerder.
- **Platformbeheerder**: gebruiker met bevoegdheid boven de beheerder van een organisatie;
  beheert het team van elke organisatie via het tabblad Team in Instellingen.
- **Bestaande gegevens van een teamlid**: gesprekken, assistenten en kennisbronnen die aan
  een teamlid zijn gekoppeld. Deze blijven bestaan bij blokkeren en deblokkeren.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Een kantoorbeheerder kan een collega uitnodigen in minder dan twee minuten,
  en 95% van de uitnodigingsmails arriveert binnen twee minuten na verzenden.
- **SC-002**: 100% van de uitnodigingskoppelingen werkt precies één keer en verloopt na
  24 uur; 0 verlopen of gebruikte koppelingen leiden tot een activering.
- **SC-003**: 0 uitnodigingen leiden tot een tweede account voor hetzelfde e-mailadres,
  ook niet bij verschillen in hoofdletters of spaties; 100% van de dubbele adressen levert
  de voorgeschreven Nederlandse melding op en verstuurt geen e-mail.
- **SC-004**: 100% van de advies- en andere-organisatiepogingen wordt door de server
  geweigerd, ook bij rechtstreekse aanroepen buiten de gebruikersinterface.
- **SC-005**: 0 teamacties laten een account zonder profiel, een profiel zonder account of
  een openstaande uitnodiging zonder account achter, ook niet wanneer een stap opzettelijk
  mislukt.
- **SC-006**: Na blokkeren ontvangt 100% van de verzoeken met het token van het
  geblokkeerde teamlid vanaf het eerstvolgende verzoek geen gegevens en geen toelating
  meer; 100% van de geblokkeerde gebruikers ziet de Nederlandse blokkademelding.
- **SC-007**: Na deblokkeren kan 100% van de teamleden inloggen met het bestaande
  wachtwoord en ziet 100% de eigen gesprekken, assistenten en kennisbronnen terug.
- **SC-008**: 0 pogingen om het eigen account te blokkeren, de eigen rol te wijzigen, de
  laatste actieve beheerder te blokkeren of te degraderen, of een platformbeheerder te
  blokkeren of te degraderen slagen — ook niet buiten de gebruikersinterface.
- **SC-009**: De eenmalige token uit de uitnodigingskoppeling komt in 0 gevallen voor in
  analytische gegevens, logbestanden of browseropslag.
- **SC-010**: 100% van de bestaande gebruikers is na de migratie Actief, houdt dezelfde
  rol en gegevens en hoeft niet opnieuw in te loggen; 0 gebruikers merken zichtbaar iets
  van de migratie.
- **SC-011**: 100% van de nieuwe en gewijzigde interfaceteksten is Nederlands in de
  u-vorm; 100% van de teamacties is met het toetsenbord te bedienen en 100% van de
  knoppen met alleen een icoon heeft een toegankelijke naam.
- **SC-012**: Een teamoverzicht van 100 teamleden is binnen twee seconden zichtbaar en
  blijft bruikbaar met het toetsenbord.
- **SC-013**: 100% van de opnieuw verstuurde of ingetrokken uitnodigingen maakt de vorige
  koppeling direct ongeldig; 0 oude koppelingen blijven daarna werken.

## Assumptions

**Buiten scope** (vastgelegd in de opdracht):

- Accounts en hun gegevens definitief verwijderen.
- Eén persoon in meerdere organisaties.
- Naam of e-mailadres van een teamlid wijzigen.
- Gebruikers die buiten de app in het beheerpaneel van de inlogvoorziening worden
  aangemaakt.
- De bestaande tabel met uitnodigingen verwijderen.
- Het aanmaken van een organisatie omzetten naar een uitnodiging.

**Aannames en gemaakte keuzes**:

- De app is de enige ingang voor teambeheer. Accounts die buiten de app worden aangemaakt,
  vallen buiten deze feature en worden niet als teamlid behandeld.
- Elk bestaand account waarvan het e-mailadres niet bij de eigen organisatie hoort, wordt
  als "andere organisatie" behandeld, ook als het profiel ontbreekt of onvolledig is.
- Voor het versturen van de uitnodigingsmail is een werkende transactionele
  e-mailvoorziening beschikbaar. De afzender toont "Darwin"; het antwoordadres is dat van
  de organisatie of het platform.
- De status van een teamlid is afgeleid van het leven van het account: Uitgenodigd tot de
  eerste keer een wachtwoord is gekozen, daarna Actief, en Geblokkeerd na een blokkade.
- Uitgenodigde, actieve en geblokkeerde teamleden staan in hetzelfde teamoverzicht. Een
  aparte kaart met alleen openstaande uitnodigingen is niet nodig.
- Een uitnodiging geldt als gebruikt zodra de collega een wachtwoord heeft gekozen. Tot
  dat moment kan de beheerder de uitnodiging opnieuw versturen of intrekken.
- Intrekken verwijdert het nog niet gebruikte account. Dit is geen definitieve verwijdering
  van gebruiksgegevens, omdat de collega nog niets heeft aangemaakt.
- Opnieuw versturen vervangt de bestaande koppeling; er ontstaat geen tweede uitnodiging
  of tweede account.
- Blokkeren kan alleen voor een teamlid dat al actief is. Voor een uitgenodigd teamlid is
  intrekken de passende actie.
- "Laatste actieve beheerder" betekent: de enige persoon in de organisatie met rol
  Beheerder én status Actief. Een uitgenodigde beheerder telt niet mee.
- De waarborg tegen het blokkeren van de laatste actieve beheerder geldt voor iedereen,
  inclusief de platformbeheerder. De bescherming van een platformbeheerder tegen een
  kantoorbeheerder geldt aanvullend.
- De pagina Team blijft de plek voor een kantoorbeheerder. De platformbeheerder gebruikt
  het tabblad Team in Instellingen; als gewoon teamlid van de eigen organisatie kan de
  platformbeheerder daar ook de eigen teampagina zien.
- Een adviseur ziet geen teambeheer. De bestaande zichtbaarheid van namen en avatars
  binnen de eigen organisatie blijft ongewijzigd.
- "Direct" betekent: vanaf het eerstvolgende verzoek van de betrokken gebruiker. Een
  al geopende pagina kan gegevens tonen die vóór de blokkade zijn opgehaald; zodra de
  pagina een nieuw verzoek doet, wordt de toegang geweigerd en verschijnt de melding.
- Openstaande uitnodigingen van een geblokkeerde beheerder blijven geldig tot ze verlopen
  en kunnen door een andere beheerder worden ingetrokken.
- De exacte teksten voor de drie voorgeschreven meldingen staan vast. Voor de overige
  fouten is de eis: een zichtbare Nederlandse melding die concreet zegt wat er mis is en
  wat de gebruiker kan doen.
- Een wachtwoord moet minimaal acht tekens bevatten, passend bij de bestaande
  wachtwoordregels van de applicatie.
- Bestaande organisaties hebben na de migratie minimaal één actieve beheerder. Als dat
  niet zo is, stopt de ingebruikname met een expliciete melding in plaats van de situatie
  stil te laten voortbestaan.
