# Contract: Autorisatie-matrix (DB + storage + UI)

**Feature**: [spec.md](../spec.md) | **Date**: 2026-10-15 | **Branch**: `010-admin-only-management`

Dit is het bindende autorisatiecontract tussen spec (FR-001 t/m FR-011) en
implementatie. Het bestaat uit drie lagen die samen de "defense in depth"
vormen: databank-policies (laatste verdedigingslinie), storage-policies en
conditioneel UI-renderen (gebruikersbeleving).

## 1. Databank-matrix (RLS)

Volledige voor/na-matrix met beleidsnamen en -locaties:
[data-model.md](../data-model.md). Samengevat:

| Resource | member mag lezen (eigen org) | member mag schrijven | admin mag lezen (eigen org) | admin mag schrijven |
|---|---|---|---|---|
| `ai_assistants` | ✅ | ❌ (RLS-weigering) | ✅ | ✅ |
| `knowledge_bases` | ✅ | ❌ | ✅ | ✅ |
| `knowledge_base_documents` | ✅ | ❌ | ✅ | ✅ (UPDATE blijft default deny, zoals voorheen) |
| `knowledge_items` | ✅ | ❌ | ✅ | ✅ (UPDATE blijft default deny, zoals voorheen) |
| `assistant_knowledge_bases` | ✅ | ❌ | ✅ | ✅ |
| eigen `conversations` / `messages` / `feedback_interactions` | ✅ | ✅ (ongewijzigd) | ✅ (eigen) | ✅ (eigen) |

De member-weigeringen gelden voor alle 15 combinaties (5 tabellen ×
INSERT/UPDATE/DELETE) — SC-001. Elke schrijfactie van een member onder deze
tabellen retourneert een RLS-fout (PostgREST foutcode 42501) zónder
gegevenswijziging.

## 2. Storage-matrix (bucket `knowledge-documents`)

| Operatie | member | admin |
|---|---|---|
| lezen (SELECT, org-pad) | ✅ | ✅ |
| uploaden (INSERT) | ❌ (RLS-weigering) | ✅ |
| overschrijven (UPDATE) | ❌ (RLS-weigering) | ✅ |
| verwijderen (DELETE) | ❌ (RLS-weigering) | ✅ |

De UPDATE-hardening hoort bij hetzelfde contract: zonder die regel kan een
member de upload-weigering omzeilen door een bestaand bestand te overschrijven.

## 3. UI-render-contract (per component)

Regel: beheerbesturing wordt **conditioneel gerenderd** (`{isAdmin && …}`), nooit
visueel-only verborgen. Wat niet gerenderd is, bestaat niet in de DOM en is
dus ook niet via toetsenbord, schermlezers of devtools-bediende events
bereikbaar (FR-004, SC-003, constitution IV).

### `src/pages/AssistantsPage.tsx`

| Element | member | admin |
|---|---|---|
| Pagina-ondertitel ("Beheer je AI assistenten…") | aangepaste lees-variant (NL, zakelijk) | ongewijzigd |
| Knop "Nieuwe assistent" (`:70-72`) | niet gerenderd | ✅ |
| EmptyState-CTA "Maak assistent" (`:80`) | niet gerenderd (lege-variant) | ✅ |
| Assistentenlijst | alleen `is_active === true` | alles, inactief met `opacity-60` |
| Badge "Inactief" (`:93`) | niet van toepassing (geen inactieve zichtbaar) | ✅ |
| Typebadge (`:94`) | labelmap: `chat` → "Chat", `risico_analyse` → "Risico-analyse" | idem (FR-001 geldt voor alle rollen) |
| Kaartomschrijving (`:100`) | `a.description ?? ''` — nóóit `system_prompt`-fallback | idem (FR-003) |
| Startknop "Chat" (`:109-111`) / "Risico-analyse starten" (`:104-107`) | ✅ | ✅ |
| Bewerkknop Pencil (`:113-115`) | niet gerenderd | ✅ |
| Bewerk-/aanmaakmodal (webhook-URL `:290-294`, KB-koppelingen `:295-315`, verwijderen `:324-361`) | niet bereikbaar (geen triggers) | ✅ (FR-005: webhook-URL alleen hier, admin-only) |

### `src/pages/KnowledgePage.tsx`

| Element | member | admin |
|---|---|---|
| Pagina-ondertitel ("Beheer documenten…") | aangepaste lees-variant | ongewijzigd |
| Knop "Nieuwe kennisbron" (`:58-60`) | niet gerenderd | ✅ |
| EmptyState-CTA (`:68`) | niet gerenderd (leeg-variant) | ✅ |
| Kennisbronkaart → KBSlideOver via kaartklik (`:73`) | ✅ (FR-006-toegang blijft) | ✅ |
| KB-bewerkknop "Bewerken" (`:86-88`) → KBMappingModal | niet gerenderd | ✅ |
| KBSlideOver: documentstatusbadges (`:346-354`) | ✅ | ✅ |
| KBSlideOver: upload-zone (`:320-327`) | niet gerenderd | ✅ |
| KBSlideOver: document-verwijderknop (`:355-357`) | niet gerenderd | ✅ |
| KBSlideOver: kennisitem-lijst + embeddingstatus (`:408-428`) | ✅ (alleen-lezen) | ✅ |
| KBSlideOver: kennisitem-formulier (`:367-401`) + item-verwijderknop (`:423-425`) | niet gerenderd | ✅ |
| KBSlideOver: tab "Gekoppeld" (`:433-451`) | ✅ (alleen-lezen) | ✅ |

### Ongewijzigde laag (expliciet contract-onderdeel)

- `src/hooks/queries.ts`: alle mutatiehooks bestaan ongewijzigd; de lees-hooks
  worden niet gefilterd (FR-009).
- `src/lib/storage.ts`: `uploadDocument` / `deleteDocument` bestaan ongewijzigd;
  hun aanroepers zijn na UI-gating admin-only en de RLS-laag weigert misbruik.
- Routes `/assistants` en `/knowledge` blijven toegankelijk voor beide rollen
  (geen route-guards); Team en Instellingen zijn al admin-only (buiten scope).

## 4. Foutgedrag (constitution V)

- Een member die desondanks een schrijfmutatie onderneemt (bijv. oude
  browser-bundel na deploy) krijgt de bestaande foutafhandeling van de
  mutatiehooks: een getoonde foutmelding, nooit een stille mislukking.
- De UI genereert géén nieuwe foutmeldingen onder normaal gebruik: members
  zien de besturing niet, dus ze kunnen deze ook niet mislukken.

## 5. Verificatie-ankers

- SC-001 → `scripts/rls-verify.mjs` (15 combinaties, direct tegen live DB).
- SC-002 → idem, storage-sectie.
- SC-003/005/006 → `tests/e2e/admin-only-management.spec.ts` (DOM-afwezigheid
  van besturing + toetsenbord-volgorde + admin-pariteit).
- F-01/F-10 (RLS-enabled + bucket-policies) → `@fitness-checker` via Supabase
  MCP na de feature (AGENTS.md).