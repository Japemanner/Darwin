import { z } from 'zod'
import {
  FunctionsHttpError,
  FunctionsRelayError,
  FunctionsFetchError,
} from '@supabase/supabase-js'
import { supabase } from './supabase'

// Typed client for the rag-chat Edge Function (constitution V: typed external
// clients, no silent failures). Contract: specs/009-secure-n8n-proxy/contracts/rag-chat.md

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
  UPSTREAM_TIMEOUT: 'De assistant reageert niet binnen de toegestane tijd. Probeer het opnieuw.',
  UPSTREAM_UNREACHABLE: 'Kon geen verbinding maken met de assistent-service.',
  INVALID_RESPONSE: 'Er ging iets mis bij het verwerken van het antwoord. Probeer het opnieuw.',
}

const RagSourceSchema = z.object({
  knowledge_item_id: z.string().optional(),
  title: z.string().optional(),
  excerpt: z.string().optional(),
  score: z.number().optional(),
})

const RagResponseSchema = z.object({
  answer: z.string(),
  sources: z.array(RagSourceSchema).nullable().optional(),
  verification: z
    .object({
      grounded: z.boolean(),
      confidence: z.number(),
      issues: z.array(z.string()),
    })
    .nullable()
    .optional(),
  rewritten_query: z.string().nullable().optional(),
})

export interface RagSource {
  knowledge_item_id?: string
  title?: string
  excerpt?: string
  score?: number
}

export interface RagVerification {
  grounded: boolean
  confidence: number
  issues: string[]
}

export interface RagChatResult {
  answer: string
  sources: RagSource[] | null
  verification: RagVerification | null
  rewritten_query: string | null
}

const GENERIC_ERROR = ERROR_TEXTS.UPSTREAM_ERROR

async function toRagClientError(err: unknown): Promise<RagClientError> {
  if (err instanceof FunctionsHttpError) {
    const body = await err.context.json().catch(() => null) as { code?: string; message?: string } | null
    const code = body?.code as RagErrorCode | undefined
    if (code && code in ERROR_TEXTS) {
      return new RagClientError(code, body?.message || ERROR_TEXTS[code])
    }
    // Unknown server code (e.g. INTERNAL_ERROR) -> generic Dutch message.
    return new RagClientError('UPSTREAM_ERROR', GENERIC_ERROR)
  }
  if (err instanceof FunctionsRelayError || err instanceof FunctionsFetchError) {
    return new RagClientError('UPSTREAM_UNREACHABLE', ERROR_TEXTS.UPSTREAM_UNREACHABLE)
  }
  return new RagClientError('UPSTREAM_ERROR', GENERIC_ERROR)
}

export async function askAssistant(input: {
  assistantId: string
  conversationId: string
  message: string
}): Promise<RagChatResult> {
  const { data, error } = await supabase.functions.invoke('rag-chat', {
    body: {
      assistant_id: input.assistantId,
      conversation_id: input.conversationId,
      message: input.message,
    },
  })

  if (error) throw await toRagClientError(error)

  const parsed = RagResponseSchema.safeParse(data)
  if (!parsed.success) {
    throw new RagClientError('INVALID_RESPONSE', ERROR_TEXTS.INVALID_RESPONSE)
  }

  return {
    answer: parsed.data.answer,
    sources: parsed.data.sources ?? null,
    verification: parsed.data.verification ?? null,
    rewritten_query: parsed.data.rewritten_query ?? null,
  }
}