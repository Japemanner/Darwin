# Contract: UI copy

**Feature**: 017-dutch-ui-language · **Applies to**: every user-facing string in `src/`

## 1. Language rules

1. Visible and assistive copy is Dutch in the formal "u" form: "Beheer uw AI-assistenten",
   "Typ uw bericht", "Controleer uw inbox", "Weet u zeker dat u … wilt verwijderen?".
2. Forbidden whole words: `je`, `jij`, `jouw`, `jullie`, `jezelf` (also in compounds such
   as "je-omgeving"). Imperatives are allowed when they are role-neutral ("Beheer …",
   "Kies …", "Vul … in").
3. English words are forbidden outside the allowlist in §2. One term per concept (§3).
4. Copy includes: JSX text, button and link labels, headings, descriptions, placeholders,
   `aria-label`, `title`, `alt`, empty states, toasts (title + description), dialog copy,
   error and status text, and text rendered only for screen readers.
5. Out of scope (must not be edited): assistant answer content, Supabase Auth e-mail
   templates, `public/handleiding.html`.

## 2. Allowlist

Allowed as-is in visible copy:

| Term | Why |
|------|-----|
| Darwin | product name |
| n8n | product name |
| AI | established abbreviation, part of the product domain ("AI-assistent") |
| webhook, URL, token, CORS, header, PDF, DOCX | technical terms Jaap approved |
| Literal n8n interface labels | the user must find them in n8n: `Production URL`, `Test URL`, `Header Name`, `Header Value`, `Header auth`, `Settings`, `Authentication`, `Active`, `Enabled`, `Allow Origin` |
| Code identifiers in `<code>` | API/payload field names: `tenantId`, `knowledgeSourceName`, `document_name`, `document_type`, `download_url`, `X-Webhook-Token` |

Everything else is translated. Common fixes:

| English | Dutch |
|---------|-------|
| Command Center | Overzicht |
| Roadmap | Ideeën en wensen |
| runs (history) | gesprekken |
| runs (analysis) | uitvoeringen |
| feature / feature request | idee of wens / verzoek |
| assistant(s) | assistent(en) |
| tenant | organisatie |
| admin / member | beheerder / adviseur |
| signed download URL | ondertekende download-URL |
| payload | bericht |
| server-side | aan de serverkant |
| vector database | kennisindex |
| reset-link | herstelkoppeling |
| workflow (our prose) | werkstroom |

## 3. Terminology

| Concept | Term | Not |
|---------|------|-----|
| person who chats/analyses | adviseur | lid, member |
| person who manages | beheerder | admin |
| AI entity | assistent | assistant |
| assistant chat history item | gesprek | run, conversatie |
| risk-analysis execution | uitvoering | run |
| knowledge source | kennisbron | knowledge base |
| knowledge item | kennisitem | item (alone) |
| customer reference | klantreferentie | — |
| product | Darwin | — |
| automation platform | n8n | N8N (in our own prose; a field label that already says N8N may stay) |

## 4. Inventory format (`copy-inventory.md`)

```markdown
# Copy inventory — 017-dutch-ui-language
**Status**: Concept / Approved (date, by Jaap)

| # | bestand | scherm/onderdeel | oud | nieuw |
|---|---------|------------------|-----|-------|
| 1 | src/pages/HistoryPage.tsx | Geschiedenis · paginakop | Alle eerdere runs van je assistenten | Alle eerdere gesprekken van uw assistenten |

## Reviewed, unchanged
- src/components/chat/ChatComposer.tsx — already "u" form, allowlisted terms only
```

Rules:

- One row per changed string; unchanged strings of a touched file are listed under
  "Reviewed, unchanged" or left out only if the file has no user-facing copy at all.
- Inline JSX expressions are written as `{naam}` so the row stays readable and
  unambiguous.
- Rows are grouped per file, in source order.
- `Status` stays `Concept` until Jaap approves; after approval the date and approver are
  recorded. Any change after approval requires a new approval of the affected rows.

## 5. Approval gate

Implementation (any edit under `src/`) MUST NOT start before the inventory status is
`Approved`. If a string turns out to be missing during implementation, it is added to
the inventory and approved before it is edited.

## 6. Verification

- Re-run the source searches from `plan.md` §Step 1 and compare with the inventory.
- Grep the copy for forbidden forms:
  - `\b(je|jij|jouw|jullie|jezelf)\b` in `src/**/*.tsx`
  - the English list in §2 outside allowed contexts
- Steekproef: pick ten random inventory rows and confirm the app shows `nieuw`.
