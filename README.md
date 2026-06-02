# Darwin — AI Platform Frontend

React 18 + TypeScript + Vite frontend voor het Darwin AI platform, geïntegreerd met Supabase en N8N.

## Tech Stack

| Layer      | Technologie                         |
|------------|-------------------------------------|
| Frontend   | React 18 + TypeScript + Vite        |
| Styling    | Tailwind CSS v3 + shadcn/ui         |
| Auth       | Supabase Auth (PKCE flow)           |
| Database   | Supabase PostgreSQL (RLS enabled)   |
| File Storage | Supabase Storage                  |
| Backend    | Supabase Edge Functions (Deno/TS)   |
| Deployment | Netlify                             |
| State      | Zustand                             |

## Setup

```bash
cp .env.example .env.local
# Vul in .env.local de juiste Supabase credentials in:
#   VITE_SUPABASE_URL=https://[project-ref].supabase.co
#   VITE_SUPABASE_ANON_KEY=[your-anon-key]
#   VITE_N8N_DOCUMENT_WEBHOOK=[your-n8n-webhook-url]
npm install
npm run dev
```

## Eerste admin aanmaken

1. Ga naar je Supabase project → SQL Editor en draai `supabase/migrations/001_initial_schema.sql` (één keer voor het volledige schema, inclusief RLS policies en triggers)

2. Maak een organizeratie aan via de Supabase SQL Editor:
```sql
INSERT INTO organizations (name) VALUES ('Mijn Organisatie');
-- Noteer het gegenereerde UUID
```

3. Maak een admin aan:
   - Ga naar Authentication → Users → Add User
   - Vul e-mail en wachtwoord in
   - Ga naar je Supabase project → SQL Editor en draai:
```sql
UPDATE profiles
SET organization_id = '<org-uuid>', role = 'admin'
WHERE id = '<user-uuid>';
```

4. Deploy de Edge Function via Supabase CLI:
```bash
supabase functions deploy invite-user
```

5. Open `http://localhost:5173/login` en log in met je admin account

## Projectstructuur

```
src/
├── lib/
│   ├── supabase.ts        # Single Supabase client instance (PKCE)
│   ├── storage.ts         # Storage helper functions
│   └── utils.ts           # cn() utility
├── types/
│   └── database.types.ts  # Generated Supabase types
├── store/
│   └── authStore.ts       # Zustand auth store
├── hooks/
│   └── useAuth.ts         # Auth hook
├── components/
│   ├── auth/              # LoginPage, ProtectedRoute
│   ├── layout/            # AppShell + Sidebar
│   └── ui/                # shadcn/ui components
├── pages/
│   ├── CommandCenterPage.tsx  # Welkom + stat cards
│   ├── AssistantsPage.tsx # Grid, modal, chat window
│   ├── KnowledgePage.tsx  # Grid, slide-over, upload
│   └── TeamPage.tsx       # Ledenlijst + invite flow
├── App.tsx                # Router + providers
└── main.tsx               # Entry point
```

## Edge Functions

| Function       | Pad                              | Beschrijving               |
|----------------|----------------------------------|----------------------------|
| `invite-user`  | `supabase/functions/invite-user` | Nodig teamleden uit per e-mail |

## Migration

`supabase/migrations/001_initial_schema.sql` bevat het volledige schema:
- `organizations`, `profiles`, `invitations`
- `ai_assistants`, `knowledge_bases`, `knowledge_base_documents`
- `assistant_knowledge_bases` (junction)
- `conversations`, `messages`
- RLS policies op alle tabellen
- `handle_new_user()` trigger voor auto-profile creatie
- `update_updated_at()` trigger op alle relevante tabellen

## N8N Webhook contract

POST body naar `ai_assistants.n8n_webhook_url`:
```json
{
  "message": "string",
  "conversation_id": "uuid",
  "assistant_id": "uuid",
  "organization_id": "uuid",
  "user_id": "uuid"
}
```
Verwacht response: `{ "response": "string" }`

