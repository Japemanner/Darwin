import { z } from 'zod'
import {
  FunctionsHttpError,
  FunctionsRelayError,
  FunctionsFetchError,
} from '@supabase/supabase-js'
import { supabase } from './supabase'

// Typed client for the rag-chat Edge Function (constitution V: typed external
// clients, no silent failures). Contract: specs/011-resumable-chat-page/contracts/rag-chat.md
// v2: client-generated message_id, optional conversation_id (first turn creates
// the conversation server-side), persisted answer in the response.

export type RagErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_CONFIGURED'
  | 'UPSTREAM_AUTH'
  | 'UPSTREAM_ERROR'
  | 'UPSTREAM_TIMEOUT'
  | 'UPSTREAM_UNREACHABLE'
  | 'INVALID_RESPONSE'

export class RagClientError extends Error {
  readonly code: RagErrorCode
  constructor(code: RagErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

const ERROR_TEXTS: Record<RagErrorCode, string> = {
  UNAUTHORIZED: 'Uw sessie is verlopen. Log opnieuw in.',
  FORBIDDEN: 'U heeft geen toegang tot deze assistent of dit gesprek.',
  NOT_CONFIGURED: 'Er is geen koppeling geconfigureerd. Neem contact op met de beheerder.',
  UPSTREAM_AUTH: 'De koppeling weigert de verbinding. Controleer het token en de headernaam in de instellingen.',
  UPSTREAM_ERROR: 'De assistent-service gaf een fout. Probeer het opnieuw of neem contact op met de beheerder.',
  UPSTREAM_TIMEOUT: 'De assistent reageert niet binnen de toegestane tijd. Probeer het opnieuw.',
  UPSTREAM_UNREACHABLE: 'Kon geen verbinding maken met de assistent-service.',
  INVALID_RESPONSE: 'Er ging iets mis bij het verwerken van het antwoord. Probeer het opnieuw.',
}

const RagSourceSchema = z.object({
  knowledge_item_id: z.string().optional(),
  title: z.string().optional(),
  excerpt: z.string().optional(),
  score: z.number().optional(),
  // Future n8n source location (out of scope for n8n itself); zod strips
  // unknown keys, so the field needs to be declared to survive the live
  // path (specs/013-readable-verifiable-answers/contracts/chat-source-display.md §1).
  page: z.string().optional(),
})

// Verification verdict passed through by n8n and persisted as jsonb on
// messages.verification (feature 012, migration 017).
const RagVerificationSchema = z.object({
  grounded: z.boolean(),
  confidence: z.number(),
  issues: z.array(z.string()),
})

const RagAssistantMessageSchema = z.object({
  id: z.string(),
  content: z.string(),
  sources: z.array(RagSourceSchema).nullable().optional(),
  created_at: z.string(),
})

const RagResponseSchema = z.object({
  conversation_id: z.string(),
  user_message_id: z.string(),
  assistant_message: RagAssistantMessageSchema,
  verification: RagVerificationSchema.nullable().optional(),
  rewritten_query: z.string().nullable().optional(),
})

export interface RagSource {
  knowledge_item_id?: string
  title?: string
  excerpt?: string
  score?: number
  page?: string
}

export interface RagVerification {
  grounded: boolean
  confidence: number
  issues: string[]
}

// Narrows the untyped messages.verification jsonb column (Record<string,
// unknown> | null) to RagVerification. Absent or malformed data returns
// null — the UI then renders no verdict line and no error (FR-007, spec
// edge case; not a swallowed failure: null is the documented behavior).
export function parseVerification(value: unknown): RagVerification | null {
  const parsed = RagVerificationSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

export interface RagAssistantMessage {
  id: string
  content: string
  sources: RagSource[] | null
  created_at: string
}

export interface RagChatResult {
  conversationId: string
  userMessageId: string
  assistantMessage: RagAssistantMessage
  verification: RagVerification | null
  rewrittenQuery: string | null
}

const GENERIC_ERROR = ERROR_TEXTS.UPSTREAM_ERROR

async function toRagClientError(err: unknown): Promise<RagClientError> {
  if (err instanceof FunctionsHttpError) {
    const body = await err.context.json().catch(() => null) as { code?: string; message?: string } | null
    const code = body?.code as RagErrorCode | undefined
    if (code && code in ERROR_TEXTS) {
      return new RagClientError(code, body?.message || ERROR_TEXTS[code])
    }
    // Unknown server code (e.g., INTERNAL_ERROR) -> generic Dutch message.
    return new RagClientError('UPSTREAM_ERROR', GENERIC_ERROR)
  }
  if (err instanceof FunctionsRelayError || err instanceof FunctionsFetchError) {
    return new RagClientError('UPSTREAM_UNREACHABLE', ERROR_TEXTS.UPSTREAM_UNREACHABLE)
  }
  return new RagClientError('UPSTREAM_ERROR', GENERIC_ERROR)
}

export async function askAssistant(input: {
  assistantId: string
  /** Omit on the first turn of a new conversation; the server creates it. */
  conversationId?: string
  /** Client-generated uuid; reuse the same id when retrying a failed turn. */
  messageId: string
  message: string
}): Promise<RagChatResult> {
  const { data, error } = await supabase.functions.invoke('rag-chat', {
    body: {
      assistant_id: input.assistantId,
      ...(input.conversationId ? { conversation_id: input.conversationId } : {}),
      message_id: input.messageId,
      message: input.message,
    },
  })

  if (error) throw await toRagClientError(error)

  const parsed = RagResponseSchema.safeParse(data)
  if (!parsed.success) {
    throw new RagClientError('INVALID_RESPONSE', ERROR_TEXTS.INVALID_RESPONSE)
  }

  return {
    conversationId: parsed.data.conversation_id,
    userMessageId: parsed.data.user_message_id,
    assistantMessage: {
      id: parsed.data.assistant_message.id,
      content: parsed.data.assistant_message.content,
      sources: parsed.data.assistant_message.sources ?? null,
      created_at: parsed.data.assistant_message.created_at,
    },
    verification: parsed.data.verification ?? null,
    rewrittenQuery: parsed.data.rewritten_query ?? null,
  }
}