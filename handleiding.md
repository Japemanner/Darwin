# Handleiding — Kennisbronnen & N8N Webhook

## Kennisbronnen instellen

### 1. Nieuwe kennisbron aanmaken

1. Ga naar **Kennisbronnen** in de sidebar
2. Klik op **+ Nieuwe kennisbron**
3. Vul een naam in (bijv. "HR Documenten") en optioneel een beschrijving
4. Klik **Opslaan**

### 2. Documenten uploaden

1. Klik op een kennisbron om de detailweergave te openen
2. In de **Documenten** tab: klik op het upload-gebied of sleep een bestand
3. Toegestane typen: **PDF, TXT, DOCX**
4. Het document verschijnt in de lijst met status **Verwerken**

### 3. Documenten verwijderen

Klik op het prullenbak-icoon naast een document om het permanent te verwijderen uit zowel Supabase Storage als de database.

---

## N8N Webhook instellen

### Wat stuurt Darwin naar N8N?

Bij elke documentupload stuurt Darwin een POST naar de webhook URL:

```json
{
  "tenant_id": "uuid-van-organisatie",
  "document_name": "handleiding.pdf",
  "document_type": "pdf",
  "download_url": "https://xxx.supabase.co/storage/v1/object/sign/..."
}
```

De `download_url` is **15 minuten geldig**. N8N moet het document binnen die tijd downloaden.

### Stap 1 — Webhook URL instellen in Darwin

Zet in `.env.local`:

```env
VITE_N8N_DOCUMENT_WEBHOOK=https://jouw-n8n-domein/webhook/documents
```

### Stap 2 — N8N workflow aanmaken

1. Open N8N, maak een nieuwe workflow
2. Voeg een **Webhook** trigger node toe:
   - HTTP Method: `POST`
   - Path: `/documents`
   - Response Mode: `Last Node`
3. **Activeer** de workflow — je ziet nu de **Production URL**
4. Kopieer die URL naar `.env.local` als `VITE_N8N_DOCUMENT_WEBHOOK`

### Stap 3 — Supabase credentials in N8N

N8N heeft de service role key nodig om documenten te downloaden en de status te updaten:

| Variabele | Waardev | Waar te vinden |
|-----------|---------|----------------|
| `SUPABASE_URL` | `https://xxx.supabase.co` | Supabase Dashboard → Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Supabase Dashboard → Settings → API → service_role |

Zet deze als **N8N Credentials** (type: Supabase) of als environment variables in je N8N Docker container.

### Stap 4 — N8N flow logica

Je flow moet minimaal deze stappen bevatten:

```
Webhook → Download bestand (via download_url) → Chunk + Embed → Update status in Supabase
```

1. **Webhook** node vangt de POST op → geeft `tenant_id`, `document_name`, `document_type`, `download_url`
2. **HTTP Request** node (`GET {download_url}`) → downloadt het bestand (binnen 15 min!)
3. **Chunk + Embed** naar je vector database (bijv. via LangChain node of custom code)
4. **Supabase** node → `UPDATE knowledge_base_documents SET status = 'ready' WHERE name = '{document_name}'`

Bij fouten: zet status op `error`.

### Testen

1. Start Darwin: `npm run dev`
2. Upload een PDF naar een kennisbron
3. Open N8N → **Executions** → je ziet een nieuwe webhook call met de payload
4. Controleer of de flow het document correct verwerkt

---

## Problemen oplossen

| Probleem | Oplossing |
|----------|----------|
| Upload faalt | Controleer of `.env.local` Supabase credentials bevat |
| Webhook wordt niet verstuurd | Controleer `VITE_N8N_DOCUMENT_WEBHOOK` in `.env.local` — feature werkt ook zonder |
| N8N krijgt geen data binnen | N8N workflow geactiveerd? Webhook node gebruikt `POST`? |
| Document blijft op "Verwerken" | N8N flow updatet de status niet — check Supabase node in de flow |
| Download URL verlopen | N8N moet document binnen 15 min downloaden — vertraagt de flow? |
