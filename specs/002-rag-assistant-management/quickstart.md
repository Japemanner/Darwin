# Quickstart: RAG Assistant Management

**Feature**: 002-rag-assistant-management | **Date**: 2026-05-30

## Prerequisites

- Node.js 20+
- Supabase CLI (`npm install -g supabase`)
- Supabase project met pgvector extensie
- N8N instance met geconfigureerde RAG-webhook
- `VITE_ENCRYPTION_KEY` in `.env.local` (32-byte hex string, gegenereerd via `crypto.randomBytes(32).toString('hex')`)

## Lokale Setup

```bash
# 1. Zorg dat je op de feature branch zit
git checkout 002-rag-assistant-management

# 2. Installeer dependencies (geen nieuwe packages nodig)
npm install

# 3. Genereer encryptie key (eenmalig)
node -e "console.log('VITE_ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))" >> .env.local

# 4. Run de database migratie
supabase db push

# 5. Start dev server
npm run dev
```

## FlowConfig Instellen

1. Ga naar `http://localhost:5173/login` → log in als admin (admin-rol in `profiles` tabel)
2. Navigeer naar **Settings** (nieuw menu-item, alleen zichtbaar voor admins)
3. Vul in:
   - **Webhook URL**: `https://n8n.example.com/webhook/rag-chat`
   - **Webhook Token**: `sk-your-n8n-token`
4. Klik **Opslaan**

## Assistent Aanmaken

1. Ga naar **Assistenten**
2. Klik **Nieuwe assistent**
3. Vul in:
   - Naam: "HR Assistant"
   - System prompt: "Je bent een behulpzame HR-assistent..."
   - Type: "chat" (default)
   - Koppel 1+ kennisbronnen via de knowledge_base selector
4. Klik **Opslaan**

## Kennisbron Vullen

### File-upload (bestaand)
1. Ga naar **Kennisbronnen** → klik op een kennisbron
2. Tab **Documenten** → upload PDF/TXT/DOCX
3. Status verandert van "Verwerken" naar "Klaar"

### Text-based kennisitems (nieuw)
1. Ga naar **Kennisbronnen** → klik op een kennisbron
2. Tab **Kennisitems** (nieuw)
3. Klik **Nieuw item** → vul titel en content in
4. Optioneel: source_url voor bronvermelding
5. Status: "pending" → N8N verwerkt → "done"

## Chat Testen

1. Ga naar **Assistenten** → klik **Chat** naast een assistant
2. Typ een vraag die relevant is voor de gekoppelde kennisbronnen
3. Wacht op antwoord (spinner tijdens laden)
4. Klik op **Bronnen (N)** om gebruikte bronnen te zien

## Verificatie Queries

```sql
-- Check FlowConfig
SELECT flow_type, webhook_url, 
       LEFT(webhook_token, 20) || '...' AS token_preview 
FROM flow_configs;

-- Check knowledge_items status
SELECT embedding_status, count(*) 
FROM knowledge_items 
GROUP BY embedding_status;

-- Check messages met sources
SELECT role, content, sources 
FROM messages 
WHERE sources IS NOT NULL;
```

## Troubleshooting

| Symptoom | Oorzaak | Oplossing |
|----------|---------|----------|
| "Authenticatiefout" bij chat | Token ongeldig | Controleer `flow_configs.webhook_token` en `VITE_ENCRYPTION_KEY` match |
| Chat timeout (30s) | N8N reageert niet | Controleer N8N webhook URL en netwerk |
| Geen bronnen getoond | N8N returnt geen `sources` | Check N8N flow — response moet `sources` array bevatten |
| Oude assistants werken niet | `n8n_webhook_url` is NULL | Vul `n8n_webhook_url` opnieuw in, of upgrade naar globale config |
| Encryptie fout | Key mismatch | Regeneer `VITE_ENCRYPTION_KEY`, configureer token opnieuw |
