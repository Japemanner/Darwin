import { supabase } from './supabase'
import type { AIAssistant, Conversation, FlowConfig } from '@/types/database.types'

interface RAGWebhookPayload {
  assistant: {
    id: string
    name: string
    system_prompt: string
  }
  knowledge_bases: Array<{
    id: string
    name: string
    vector_collection_id: string
  }>
  knowledgeSourceName: string
  tenantId: string
  conversation: {
    id: string
    history: Array<{
      role: string
      content: string
    }>
  }
  message: string
}

interface RAGWebhookResponse {
  answer: string
  sources: Array<{
    knowledge_item_id: string
    title: string
    excerpt: string
    score: number
  }> | null
}

export interface WebhookTestResult {
  ok: boolean
  status: number
  message: string
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes
}

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function getEncryptionKey(): Promise<CryptoKey> {
  const keyHex = import.meta.env.VITE_ENCRYPTION_KEY
  if (!keyHex) throw new Error('VITE_ENCRYPTION_KEY is not configured')
  const rawKey = hexToBytes(keyHex)
  return crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

export async function encryptToken(plaintext: string): Promise<string> {
  const key = await getEncryptionKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plaintext)
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  const combined = new Uint8Array(iv.length + encrypted.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(encrypted), iv.length)
  return bytesToHex(combined.buffer)
}

export async function decryptToken(ciphertext: string): Promise<string> {
  if (!ciphertext) return ''
  const key = await getEncryptionKey()
  const combined = hexToBytes(ciphertext)
  const iv = combined.slice(0, 12)
  const data = combined.slice(12)
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
  return new TextDecoder().decode(decrypted)
}

function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '')
}

function classifyWebhookError(status: number, url: string): Error {
  if (status === 401) {
    return new Error('Authenticatiefout (401). Controleer of het token en de header naam overeenkomen met de n8n webhook instellingen.')
  }
  if (status === 403) {
    return new Error('Webhook geweigerd (403). Controleer of het token correct is en de header naam (bijv. X-Webhook-Token) overeenkomt met de n8n webhook instellingen.')
  }
  if (status === 404) {
    return new Error(`Webhook niet gevonden (404). Controleer de URL en of de n8n workflow actief is.${url.includes('/webhook-test/') ? ' Let op: /webhook-test/ is een test-URL, gebruik /webhook/ voor productie.' : ''}`)
  }
  if (status === 429) {
    return new Error('Te veel verzoeken (429). Wacht even en probeer opnieuw.')
  }
  if (status >= 500) {
    return new Error('De n8n workflow gaf een fout (500). Controleer de workflow logs op fouten. Controleer of alle verwachte velden aanwezig zijn in het payload.')
  }
  return new Error(`Onverwachte fout (${status}). Controleer de webhook configuratie.`)
}

async function loadFlowConfig(organizationId: string, flowType: string): Promise<FlowConfig | null> {
  const { data } = await (supabase as any).from('flow_configs') // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase type inference limitation
    .select('*')
    .eq('flow_type', flowType)
    .eq('organization_id', organizationId)
    .single()
  return data as FlowConfig | null
}

interface KnowledgeBaseWithId {
  id: string
  name: string
  vector_collection_id: string | null
}

async function loadAssistantKnowledgeBases(assistantId: string): Promise<KnowledgeBaseWithId[]> {
  const { data: links } = await (supabase as any).from('assistant_knowledge_bases') // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase type inference limitation
    .select('knowledge_base_id')
    .eq('assistant_id', assistantId)

  if (!links || links.length === 0) return []

  const { data: kbs } = await (supabase as any) // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase type inference limitation
    .from('knowledge_bases')
    .select('id, name, vector_collection_id')
    .in(
      'id',
      links.map((l: { knowledge_base_id: string }) => l.knowledge_base_id),
    )

  return (kbs as KnowledgeBaseWithId[]) ?? []
}

async function loadConversationHistory(conversationId: string): Promise<Array<{ role: string; content: string }>> {
  const { data } = await (supabase as any).from('messages') // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase type inference limitation
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (!data) return []
  return data.slice(-20).map((m: { role: string; content: string }) => ({ role: m.role, content: m.content }))
}

function buildAuthHeaders(token: string | undefined, authHeader: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) {
    headers[authHeader] = token
  }
  return headers
}

export async function callRagWebhook(
  assistant: AIAssistant,
  conversation: Conversation,
  userMessage: string,
  organizationId: string,
): Promise<RAGWebhookResponse> {
  let webhookUrl: string
  let token: string | undefined
  let authHeader = 'X-Webhook-Token'

  if (assistant.type === 'chat') {
    const config = await loadFlowConfig(organizationId, 'rag_chat')
    if (!config) {
      throw new Error('Geen RAG configuratie gevonden — neem contact op met de beheerder')
    }
    webhookUrl = normalizeUrl(config.webhook_url)
    if (!webhookUrl) {
      if (assistant.n8n_webhook_url) {
        webhookUrl = normalizeUrl(assistant.n8n_webhook_url)
      } else {
        throw new Error('Webhook URL niet geconfigureerd')
      }
    } else {
      authHeader = config.webhook_auth_header || 'X-Webhook-Token'
      token = config.webhook_token ? await decryptToken(config.webhook_token) : undefined
    }
  } else if (assistant.n8n_webhook_url) {
    webhookUrl = normalizeUrl(assistant.n8n_webhook_url)
  } else {
    throw new Error('Geen webhook URL beschikbaar voor deze assistant')
  }

  const knowledgeBases = await loadAssistantKnowledgeBases(assistant.id)
  const history = await loadConversationHistory(conversation.id)

  const { data: orgData } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', organizationId)
    .single()

  const tenantId: string = (orgData as { name: string } | null)?.name ?? organizationId

  const knowledgeSourceName = knowledgeBases.map((kb) => kb.name).join(', ') || ''

  const payload: RAGWebhookPayload = {
    assistant: {
      id: assistant.id,
      name: assistant.name,
      system_prompt: assistant.system_prompt,
    },
    knowledge_bases: knowledgeBases.map((kb) => ({
      id: kb.id,
      name: kb.name,
      vector_collection_id: kb.vector_collection_id ?? '',
    })),
    knowledgeSourceName,
    tenantId,
    conversation: {
      id: conversation.id,
      history,
    },
    message: userMessage,
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)

  try {
    const headers = buildAuthHeaders(token, authHeader)

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    if (!res.ok) {
      throw classifyWebhookError(res.status, webhookUrl)
    }

    const data = await res.json()
    return {
      answer: data.answer ?? data.response ?? 'Geen antwoord ontvangen',
      sources: data.sources ?? null,
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('De assistant reageert niet. Controleer de verbinding en probeer het opnieuw.')
    }
    if (err instanceof TypeError) {
      throw new Error('Kon geen verbinding maken met de webhook. Controleer of de URL bereikbaar is en CORS is ingeschakeld in n8n.')
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

export async function testWebhook(
  url: string,
  token?: string,
  authHeaderName: string = 'X-Webhook-Token',
): Promise<WebhookTestResult> {
  const normalizedUrl = normalizeUrl(url)

  if (normalizedUrl.includes('/webhook-test/')) {
    return {
      ok: false,
      status: 0,
      message: 'Dit is een n8n test-URL (/webhook-test/). Gebruik de productie-URL (/webhook/) voor live assistenten.',
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)

  try {
    const headers = buildAuthHeaders(token, authHeaderName)

    const res = await fetch(normalizedUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        test: true,
        timestamp: new Date().toISOString(),
        assistant: { id: 'test', name: 'Connectivity Test', system_prompt: 'test' },
        knowledge_bases: [],
        knowledgeSourceName: '',
        tenantId: 'test',
        conversation: { id: 'test', history: [] },
        message: '__test_connection__',
      }),
      signal: controller.signal,
    })

    if (res.ok) {
      return {
        ok: true,
        status: res.status,
        message: 'Verbinding geslaagd! De webhook is bereikbaar en accepteert verzoeken.',
      }
    }

    if (res.status === 500) {
      return {
        ok: true,
        status: res.status,
        message: 'Webhook bereikbaar! De workflow gaf een fout (500) bij het testbericht — dit is normaal. Zorg dat je n8n workflow een IF-node heeft die test-berichten afhandelt.',
      }
    }

    const error = classifyWebhookError(res.status, normalizedUrl)
    return {
      ok: false,
      status: res.status,
      message: error.message,
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return {
        ok: false,
        status: 0,
        message: 'Time-out: de webhook reageert niet binnen 10 seconden. Controleer of de n8n workflow actief is.',
      }
    }
    if (err instanceof TypeError) {
      return {
        ok: false,
        status: 0,
        message: 'Kon geen verbinding maken. Controleer of de URL bereikbaar is en CORS is ingeschakeld in n8n.',
      }
    }
    return {
      ok: false,
      status: 0,
      message: err instanceof Error ? err.message : 'Onbekende fout',
    }
  } finally {
    clearTimeout(timeout)
  }
}

export type DocumentAction = 'index' | 'modify' | 'delete'

export async function callDocumentWebhook(
  organizationId: string,
  knowledgeBaseName: string,
  documentId: string,
  documentName: string,
  documentType: string,
  downloadUrl: string,
  action: DocumentAction = 'index',
): Promise<void> {
  try {
    const config = await loadFlowConfig(organizationId, 'document_processing')
    if (!config || !config.webhook_url) return

    const { data: orgData } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', organizationId)
      .single()

    const tenantId: string = (orgData as { name: string } | null)?.name ?? organizationId
    const authHeader = config.webhook_auth_header || 'X-Webhook-Token'
    const token = config.webhook_token ? await decryptToken(config.webhook_token) : undefined

    const headers = buildAuthHeaders(token, authHeader)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    try {
      const res = await fetch(normalizeUrl(config.webhook_url), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action,
          tenantId,
          knowledgeSourceName: knowledgeBaseName,
          document_id: documentId,
          document_name: documentName,
          document_type: documentType,
          download_url: downloadUrl,
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        console.error('[webhook] Document webhook failed:', res.status, classifyWebhookError(res.status, config.webhook_url).message)
      }
    } catch (err) {
      console.error('[webhook] Document webhook error:', err instanceof Error ? err.message : err)
    } finally {
      clearTimeout(timeout)
    }
  } catch (err) {
    console.error('[webhook] Document webhook setup error:', err instanceof Error ? err.message : err)
  }
}