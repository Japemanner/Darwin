# Quickstart: Kennisbron Documenten Webhook

**Feature**: `001-knowledge-source-documents`
**Date**: 2026-05-29

## Ontwikkelaar Quickstart

### Vereisten

- Node.js 20+
- Supabase project (met `knowledge-documents` bucket)
- `.env.local` geconfigureerd met `VITE_N8N_DOCUMENT_WEBHOOK` (optioneel — feature werkt ook zonder)
- Branch: `001-knowledge-source-documents`

### Opstarten

```bash
npm install
npm run dev
```

### Testen

1. **Upload flow**: Ga naar Kennisbronnen → open een kennisbron → upload een PDF/TXT/DOCX bestand.
   - Verifieer: document verschijnt in de lijst met status "Verwerken".
   - Verifieer: in de browser console (Network tab) is een POST naar de N8N webhook zichtbaar met de payload `{ tenant_id, document_name, document_type, download_url }`.
   - Verifieer: de `download_url` in de payload is een gesigneerde Supabase URL (bevat `/sign/` in het pad en een `?token=` parameter).

2. **Delete flow**: Klik op het prullenbak-icoon naast een document.
   - Verifieer: document verdwijnt uit de lijst.
   - Verifieer: toast "Document verwijderd" verschijnt.

3. **Validatie**: Probeer een niet-toegestaan bestandstype te uploaden (bijv. `.jpg` of `.exe`).
   - Verifieer: upload wordt geweigerd met foutmelding.

### Test zonder N8N

Als `VITE_N8N_DOCUMENT_WEBHOOK` niet geconfigureerd is, werkt upload + delete normaal — de webhook call wordt overgeslagen. Er is geen foutmelding.

### Bestanden om te wijzigen

| Bestand | Wijziging |
|---------|----------|
| `src/lib/storage.ts` | `uploadDocument` uitbreiden met signed URL + webhook call |
| `src/pages/KnowledgePage.tsx` | Bestandstype validatie toevoegen, aanroep aanpassen |

### Handmatige verificatie Supabase Storage

```sql
-- Check of document in storage staat
SELECT * FROM storage.objects WHERE bucket_id = 'knowledge-documents';

-- Check of document record in database staat
SELECT * FROM knowledge_base_documents WHERE knowledge_base_id = '<kb-id>';
```
