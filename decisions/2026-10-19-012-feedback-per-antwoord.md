# Beslissing: Per-antwoord feedback hergebruikt feedback_interactions — volledige unieke index, policy-vervanging en beveiligde overzichtsfunctie

**Datum**: 2026-10-19 | **Feature**: 012-per-answer-feedback

## Decision

1. **Hergebruik van `feedback_interactions`** voor antwoordoordelen: `message_id`
   (FK → messages, ON DELETE CASCADE, nullable voor oude gespreksbrede rijen) + `reason`
   (CHECK met vijf redencodes) + `updated_at` (huis-trigger `update_updated_at`). Geen
   nieuwe tabel.
2. **Unieke index volledig, niet partieel**: `CREATE UNIQUE INDEX … (message_id, user_id)`
   zonder `WHERE message_id IS NOT NULL`. PostgREST (`?on_conflict=`) kan géén
   index-predicaat targeten; PostgreSQL vereist dat predicaat juist om een partieel
   unieke index te vinden (index inference) — de route-variant zou de gevraagde
   supabase-js-upsert laten falen met 42P10. NULL's zijn in PostgreSQL uniek-indexen
   verschillend (default), dus oude rijen conflicteren nooit: gedrag identiek aan de
   partiele variant.
3. **Constraint `one_feedback_per_user_per_conversation` vervalt** en de INSERT-policy
   "Users can insert own feedback" (004) wordt **vervangen** door een policy die eist
   dat het bericht in een gesprek van `auth.uid()` zit; daarnaast een UPDATE-policy met
   dezelfde eis (nodig voor `ON CONFLICT DO UPDATE`). Permissive-OR: naast elkaar
   plaatsen zou de nieuwe eis niet-afdwingbaar maken.
4. **`get_feedback_review()`**: SECURITY DEFINER met vaste `search_path = public`,
   STABLE; retourneert alleen negatieve antwoordoordelen van de eigen organisatie
   (`get_user_org_id()`) en alleen voor beheerders (`is_org_admin()`); niet-beheerders
   krijgen een lege set. Geen view met security_invoker: de RLS op `messages` toont
   beheerders alleen eigen berichten, dus een view blijft leeg.
5. **E2E met echte database-seeding** via de Supabase-client van het testaccount
   (productieproject), met cascade-cleanup via één gespreks-delete — expliciete
   opdrachtgeverskeuze, afwijkend van het mock-patroon uit 011.

## Context

Spec 012 (per-antwoord feedback + vastleggen antwoordherkomst) met een concrete
technische route van de opdrachtgever: migratie 017, rag-chat-uitbreiding,
AnswerFeedback-component, één query per gesprek, vier Playwright-scenario's. Tijdens
planning bleek één routedetail intern inconsistent: partieel unieke index + REST-upsert.

## Alternatives considered

- **Partiële index + upsert via extra RPC-functie** — afgewezen: extra DB-functie voor
  iets dat de generieke REST-upsert kan; constitution VI.
- **Partiële index + select-then-insert in de client** — afgewezen: twee round-trips,
  race-window, alsnog unique-violation-handling nodig.
- **Nieuwe tabel `message_feedback`** — afgewezen: dubbele entiteit, dubbele policies,
  terwijl de kolommen van feedback_interactions (conversation/assistant/user/org,
  thumbs_up, feedback) exact voldoen.
- **View met security_invoker** — afgewezen: leeg voor beheerders door bericht-RLS
  (route noemt dit zelf).
- **Tweefasenmigratie** (oude INSERT-policy pas na frontend-deploy laten vallen) —
  afgewezen: extra releasestaat voor een balk die de feature toch verwijdert.

## Reasoning

Eén tabel met één unieke sleutel per antwoord is het kleinste model dat "één oordeel
per gebruiker per antwoord, wijzigen overschrijft" op databaseniveau afdwingt; de
volledige index maakt dat met de bestaande REST-upsert bereikbaar zonder extra
servercomponenten. De policy-vervanging sluit bovendien het oude gat dat een gebruiker
feedback op een vreemd gesprek kon invoegen (oude policy controleerde geen eigendom
van het gesprek). De overzichtsfunctie volgt het 010/015-helperpatroon
(`is_org_admin()`/`get_user_org_id()`) en is het enige ontwerp dat beheerders
organisatiebreed inzicht geeft zonder de bericht-RLS te versoepelen (constitution III).

## Trade-offs accepted

- **Breekraam tijdens rollout**: tussen migratie en frontend-deploy faalt de oude
  productiebalk op gespreksbrede inserts (42501). Minuten tot uren, raakt alleen de
  functie die deze feature verwijdert; gedocumenteerd in quickstart §3 (lijn:
  decisions/2026-10-14-secure-n8n-proxy.md).
- **DB dwingt geen reden af bij duim omlaag** (geen cross-veld-CHECK): de UI is de
  autoriteit; bewust vermeden om het CHECK-beheer te complexifiëren (constitution VI).
- **E2E schrijft testdata naar productie**: geaccepteerd op expliciete opdracht, met
  herkenbare titels en cascade-cleanup per test.
- **Oude gespreksbrede rijen blijven bestaan** (message_id NULL): geen migratie naar
  per-antwoord-rijen mogelijk (berichten bestaan niet meer); UI toont ze niet.

## Supersedes

- `specs/004-chat-feedback-thumbs/spec.md` FR-007/US4 (één rating per gesprek,
  onwijzigbaar, verplichte tekst) — de productregels van 012 (spec
  specs/012-per-answer-feedback/spec.md FR-005/FR-009) vervangen de 004-regels;
  de tabel zelf blijft in gebruik.