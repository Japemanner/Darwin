# n8n — knowledge (bevestigd)

Feiten over de Darwin↔n8n-koppeling. Bron: feature 009-secure-n8n-proxy (rollout 2026-10-14).

- **Authenticatie**: elke n8n-webhook gebruikt Header Auth via de credential **"Darwin auth"** (Header Name `X-Webhook-Token`, Header Value = het per-organisatietoken dat in Darwin Instellingen staat). Het token is sinds 009 write-only: de browser krijgt het nooit meer terug.
- **Webhook-URL's veranderen** zodra een Webhook-node in n8n opnieuw wordt aangemaakt (nieuw UUID-pad). Controleer na n8n-wijzigingen de URL in Darwin → Instellingen; een 404 bij "Verbinding testen" wijst vrijwel altijd op een verlopen/veranderde URL.
- **Payload richting n8n (chat, sinds 009)**: `assistant {id, name, system_prompt}`, `knowledge_bases[]`, **`knowledge_sources` (string[] — nieuw)**, `knowledgeSourceName` (legacy, `"naam1, naam2"`), `tenantId` (organisatienaam, server-side vastgesteld), `conversation {id, history: laatste 20}`, `message`. n8n ontvangt nooit het Supabase-JWT.
- **Qdrant-filter (n8n-wijziging N1)**: Agentic_RAG_Search 1.5 filtert op `metadata.kennisbron` met `match.any` op de lijst `knowledge_sources`. Voorheen splitste de flow de samengevoegde `knowledgeSourceName`-string — de oorzaak van "assistent met twee kennisbronnen vindt niets".
- **Time-outs**: chat-fetch 60 s server-side; documentverwerking 10 s; verbindingstest 10 s. De server garandeert altijd een antwoord (time-out wordt een UPSTREAM_TIMEOUT-melding), dus de client heeft geen eigen abort nodig.
- **Documentverwerking**: n8n verwijdert een document uit de vectorindex idempotent — bij een lokaal mislukte verwijdering (nadat n8n al geslaagd was) is "opnieuw verwijderen" het herstelpad.