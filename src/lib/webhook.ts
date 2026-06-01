import { supabase } from './supabase'
import type { AIAssistant, Conversation, FlowConfig, KnowledgeBase } from '@/types/database.types'

interface RAGWebhookPayload {
  assistant: {
    id: string
    name: string
    system_prompt: string
  }
  knowledge_bases: Array<{
    id: string
    vector_collection_id: string
  }>
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
  const key = await getEncryptionKey()
  const combined = hexToBytes(ciphertext)
  const iv = combined.slice(0, 12)
  const data = combined.slice(12)
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
  return new TextDecoder().decode(decrypted)
}

async function loadFlowConfig(organizationId: string) {
  const { data } = await (supabase as any).from('flow_configs') // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase type inference limitation
    .select('*')
    .eq('flow_type', 'rag_chat')
    .eq('organization_id', organizationId)
    .single()
  return data as FlowConfig | null
}

async function loadAssistantKnowledgeBases(assistantId: string): Promise<KnowledgeBase[]> {
  const { data: links } = await (supabase as any).from('assistant_knowledge_bases') // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase type inference limitation
    .select('knowledge_base_id')
    .eq('assistant_id', assistantId)

  if (!links || links.length === 0) return []

  const { data: kbs } = await (supabase as any) // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase type inference limitation
    .from('knowledge_bases')
    .select('id, vector_collection_id')
    .in(
      'id',
      links.map((l: { knowledge_base_id: string }) => l.knowledge_base_id),
    )

  return (kbs as KnowledgeBase[]) ?? []
}

async function loadConversationHistory(conversationId: string): Promise<Array<{ role: string; content: string }>> {
  const { data } = await (supabase as any).from('messages') // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase type inference limitation
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (!data) return []
  return data.slice(-20).map((m: { role: string; content: string }) => ({ role: m.role, content: m.content }))
}

export async function callRagWebhook(
  assistant: AIAssistant,
  conversation: Conversation,
  userMessage: string,
  organizationId: string,
): Promise<RAGWebhookResponse> {
  let webhookUrl: string
  let token: string

  if (assistant.type === 'chat') {
    const config = await loadFlowConfig(organizationId)
    if (!config) {
      throw new Error('Geen RAG configuratie gevonden — neem contact op met de beheerder')
    }
    webhookUrl = config.webhook_url
    if (!webhookUrl) {
      if (assistant.n8n_webhook_url) {
        webhookUrl = assistant.n8n_webhook_url
        token = ''
      } else {
        throw new Error('Webhook URL niet geconfigureerd')
      }
    } else {
      token = await decryptToken(config.webhook_token)
    }
  } else if (assistant.n8n_webhook_url) {
    webhookUrl = assistant.n8n_webhook_url
    token = ''
  } else {
    throw new Error('Geen webhook URL beschikbaar voor deze assistant')
  }

  const knowledgeBases = await loadAssistantKnowledgeBases(assistant.id)
  const history = await loadConversationHistory(conversation.id)

  const payload: RAGWebhookPayload = {
    assistant: {
      id: assistant.id,
      name: assistant.name,
      system_prompt: assistant.system_prompt,
    },
    knowledge_bases: knowledgeBases.map((kb) => ({
      id: kb.id,
      vector_collection_id: kb.vector_collection_id ?? '',
    })),
    conversation: {
      id: conversation.id,
      history,
    },
    message: userMessage,
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    if (!res.ok) {
      if (res.status === 401) throw new Error('Authenticatiefout — neem contact op met de beheerder')
      if (res.status === 404) throw new Error('Webhook niet gevonden — controleer de configuratie')
      if (res.status >= 500) throw new Error('De AI-service is tijdelijk niet beschikbaar. Probeer het later opnieuw.')
      throw new Error(`HTTP ${res.status}`)
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
      throw new Error('Kon geen verbinding maken met de AI-service. Controleer je internetverbinding.')
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }
}
