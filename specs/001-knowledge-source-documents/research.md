# Research: Kennisbron Documenten — Darwin↔N8N Integratie

**Feature**: `001-knowledge-source-documents`
**Phase**: 0 — Technical Research
**Date**: 2026-05-29

## Research Questions

### RQ1: Hoe genereer je een gesigneerde (tijdelijke) download URL in Supabase Storage?

**Besluit**: Gebruik `supabase.storage.from('bucket').createSignedUrl(path, expiresIn)`.

De Supabase JS client biedt de `createSignedUrl` methode die een tijdelijke, gesigneerde URL genereert. De `expiresIn` parameter wordt opgegeven in seconden. Voor 15 minuten: `15 * 60 = 900`.

```typescript
const { data, error } = await supabase.storage
  .from('knowledge-documents')
  .createSignedUrl(filePath, 900) // 15 minuten = 900 seconden

if (data) {
  console.log(data.signedUrl) // https://xxx.supabase.co/storage/v1/object/sign/...
}
```

**Trade-off**: `createSignedUrl` vereist een authenticated Supabase client. De anon key is voldoende — het werkt met RLS policies. Dit betekent dat de download URL alleen gegenereerd kan worden door een ingelogde gebruiker die via RLS toegang heeft tot de bucket. Voor N8N (dat de URL gebruikt om te downloaden) is dit geen probleem — N8N gebruikt de gesigneerde URL zelf, die onafhankelijk van de gebruiker werkt.

**Alternatief overwogen**: `getPublicUrl` (geen expiry) — verworpen want de requirement specificeert expliciet 15 minuten geldigheid.

**Bronnen**: Supabase docs (`/supabase/supabase` — `createSignedUrl` API reference), bestaande codebase (`src/lib/storage.ts` gebruikt `getPublicUrl`).

---

### RQ2: Wat is de huidige staat van de N8N webhook integratie?

**Bevinding**: De bestaande code in `KnowledgePage.tsx:248-255` stuurt een fire-and-forget POST naar `VITE_N8N_DOCUMENT_WEBHOOK` met een minimale payload:
```json
{
  "knowledge_base_id": "...",
  "document_name": "...",
  "organization_id": "..."
}
```

**Benodigde wijzigingen**:
1. Payload uitbreiden met `tenant_id` (alias voor `organization_id`), `document_type`, en `download_url`
2. `download_url` moet een gesigneerde URL zijn — vervang `getPublicUrl` door `createSignedUrl` in de webhook payload
3. `tenant_id` expliciet toevoegen als veld (naast of ter vervanging van `organization_id`)
4. `document_type` toevoegen (bestandsextensie, lowercase)

**Besluit**: Behoud `organization_id` als bronveld, map het naar `tenant_id` in de webhook payload. Voeg `document_type` en `download_url` toe.

---

### RQ3: Hoe valideren we bestandstypen vóór upload?

**Besluit**: Twee-laags validatie:

1. **Client-side (HTML accept attribuut)**: Bestaande `accept=".pdf,.txt,.docx"` op de file input — deze geeft een visuele filter in de file picker maar is geen harde beveiliging.
2. **JavaScript validatie vóór upload**: Controleer de bestandsextensie programmatisch voordat `uploadDocument` wordt aangeroepen. Toon een toast bij ongeldig type.

```typescript
const ALLOWED_EXTENSIONS = ['pdf', 'txt', 'docx']

function isValidFileType(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase()
  return ext ? ALLOWED_EXTENSIONS.includes(ext) : false
}
```

**Trade-off**: Geen server-side validatie nodig — Supabase Storage bucket policies en RLS handelen autorisatie af. De client-side check is voldoende voor UX.

---

### RQ4: Welke wijzigingen zijn nodig in `src/lib/storage.ts`?

**Bevinding**: De `uploadDocument` functie (`src/lib/storage.ts:3-35`) moet worden uitgebreid:

1. Genereer een `createSignedUrl` na succesvolle upload
2. Return de signed URL samen met het document record
3. Haal de webhook call uit `KnowledgePage.tsx` en verplaats deze naar `storage.ts` voor centralisatie

**Besluit**: Hernoem/refactor `uploadDocument` naar een twee-staps proces:
- Stap 1: Upload bestand naar storage + insert DB record
- Stap 2: Genereer signed URL + verstuur webhook

De functie returnt een object met `{ document, signedUrl }`.

**Alternatief**: Webhook in de page component houden — verworpen want centralisatie in storage.ts maakt de functie herbruikbaarder en testbaarder.

---

### RQ5: Zijn er database-schema wijzigingen nodig?

**Bevinding**: Nee. Het bestaande `knowledge_base_documents` schema (`id`, `knowledge_base_id`, `name`, `file_path`, `file_type`, `file_size`, `status`, `created_by`) dekt alle velden die we nodig hebben. Geen migraties nodig.

**Huidige kolommen vs. webhook payload**:
| Webhook veld | Bron in DB |
|---|---|
| `tenant_id` | `organization_id` (van de KBSlideOver props, niet uit de document-record zelf) |
| `document_name` | `knowledge_base_documents.name` |
| `document_type` | `knowledge_base_documents.file_type` |
| `download_url` | Gegenereerd via `createSignedUrl(file_path, 900)` — niet opgeslagen in DB |

---

### RQ6: Environment variable aanpassingen?

**Bevinding**: `VITE_N8N_DOCUMENT_WEBHOOK` bestaat al in `.env.example` en `src/vite-env.d.ts`. Geen nieuwe env vars nodig.

---

## Conclusie

De feature vereist **geen nieuwe dependencies, geen database migraties, en geen nieuwe environment variables**. Alle wijzigingen zijn beperkt tot:

1. `src/lib/storage.ts` — uitgebreide `uploadDocument` met signed URL + webhook
2. `src/pages/KnowledgePage.tsx` — bestandstype validatie, aangepaste aanroep van `uploadDocument`
3. `src/vite-env.d.ts` — bestaand, geen wijzigingen

**Risico**: De `createSignedUrl` methode vereist dat de Storage bucket RLS policies correct zijn geconfigureerd. Dit moet via Supabase MCP geverifieerd worden.
