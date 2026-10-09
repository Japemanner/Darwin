# Data Model: Risico-analyse assistent UI

**Feature**: 008-risico-analyse-ui | **Datum**: 2026-10-09

## Client-side entiteiten (deze feature)

### AnalysisRun

De async-run zoals de UI die volgt en toont.

| Veld | Type | Beschrijving |
|------|------|--------------|
| id | string (UUID) | run-UUID; het enige klant-inhoud-vrije id in URL's |
| assistant_id | string (UUID) | de risico-analyse-assistent |
| advisor_id | string (UUID) | ingelogde adviseur (profiles.id) |
| client_reference | string | Klantreferentie; zichtbaar in run-labels, nooit in URL's |
| status | `'queued' \| 'running' \| 'succeeded' \| 'failed'` | vertaalt naar "in wachtrij", "bezig", "klaar", "mislukt" |
| started_at | string (ISO 8601) | starttijdstip; basis voor verstreken tijd |
| finished_at | string (ISO 8601) \| null | afgerond tijdstip |
| error_code | string \| null | foutcode bij `failed` |
| error_message | string \| null | Nederlandse foutmelding bij `failed` |
| result | AnalysisResult \| null | alleen bij `succeeded`; vervalt na bewaartermijn (metadata blijft) |
| dossier_docx_url | string \| null | download-URL .docx (signed; 7 dagen geldig) |
| expires_at | string (ISO 8601) | bewaartermijn-grens: 7 dagen na afronding |
| retry_payload | FormData-achtige snapshot \| null | invoer voor retry-prefill; uitsluitend in memory (geen browseropslag) |

Statusovergangen (enrichting):

```text
queued → running → succeeded
queued → running → failed
queued → failed            (backend weigert direct, bijv. validatiefout 422)
```

Onbekende status uit backend → expliciete "onbekende status"-fout
(edge case uit spec).

### AnalysisResult (zod-gevalideerd, `src/lib/analysis-schemas.ts`)

| Veld | Type | Beschrijving |
|------|------|--------------|
| risicos | `string[]` | geconstateerde risico's |
| dekking | `string` | beschikbare dekking |
| restgat | `string` | restgap na dekking |
| draagkracht | `string` | draagkracht-beoordeling (feiten, geen advies) |
| opties | `Optie[]` | opties met `titel`, `voor[]`, `tegen[]` |
| lacunes | `string[]` | gaps → checklist "Ontbrekende informatie voor het gesprek" |
| intern_signalen | `string[]` | zichtbaar gemarkeerd "intern, speculatief" |
| bronnen | `BronRef[]` | bronverwijzingen ter resolitie van [K/R/A]-referenties |

### Optie

| Veld | Type |
|------|------|
| titel | `string` |
| voor | `string[]` |
| tegen | `string[]` |

### BronRef

| Veld | Type | Validatie |
|------|------|-----------|
| id | `string` | regex `^[KRA][0-9]+$` (K = kennisbron-document, R = regelgeving, A = artikel/bijlage) |
| document | `string` | documentnaam |
| locatie | `string` | vindplaats (bijv. pagina, artikelnummer, paragraaf) |
| passage | `string` | letterlijke passage |

### InternMarkdown

`intern_markdown: string` — de interne analyse als markdown, gerenderd
via `marked` → DOMPurify (whitelist, geen raw HTML). Sectievolgorde in de
weergave: risico's → dekking en restgat → draagkracht → opties met voor
en tegen → interne signalen.

## Server-side ontwerp (backend-feature, via contracts/ vastgelegd)

### Tabel `analysis_runs` (Supabase, RLS ingeschakeld)

| Kolom | Type | Beschrijving |
|-------|------|--------------|
| id | uuid PK | |
| assistant_id | uuid FK ai_assistants | |
| advisor_id | uuid FK profiles | = auth.uid() (RLS) |
| organization_id | uuid FK organizations | tenant-isolatie (RLS) |
| client_reference | text | |
| status | text check in 4 waarden | |
| started_at / finished_at | timestamptz | |
| error_code / error_message | text null | |
| result_json | jsonb null | AnalysisResult |
| intern_markdown | text null | |
| dossier_path | text null | Supabase Storage-pad .docx |
| expires_at | timestamptz | finished_at + 7 dagen; cleanup-job verwijdert documenten |

RLS: adviseur selecteert uitsluitend eigen rijen (advisor_id =
auth.uid()); Edge Functions handelen schrijfacties met service-role
(buiten client-bereik). Geüploade invoerbestanden worden direct na
afloop verwijderd (bestaand storage-beleid); dossier_docx vervalt na
`expires_at`.

### Formuliervelden (UI-state, `react-hook-form` + zod)

| Veld | Verplicht | Validatie |
|------|-----------|-----------|
| verzekeringsvraagstuk | ja | non-empty |
| kennisbronnen | ja | min. 1 geselecteerd; opties = kennisbronnen gekoppeld aan de assistent |
| klantsituatie | nee | — |
| bestanden | nee | pdf/docx/txt; ≤ 10 MB per bestand; ≤ 25 MB totaal; limiet in UI zichtbaar |
| urls | nee | elk item `https://` — anders inline geweigerd |
| klantreferentie | ja | non-empty |
| adviseur | ja (prefilled) | readonly, uit ingelogde profile |
| — groepsregel | — | min. 1 van klantsituatie/bestanden/urls gevuld → inline melding |