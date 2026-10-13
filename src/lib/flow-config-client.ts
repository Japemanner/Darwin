import {
  FunctionsHttpError,
  FunctionsRelayError,
  FunctionsFetchError,
} from '@supabase/supabase-js'
import { supabase } from './supabase'

// Typed client for the flow-config Edge Function (constitution V: typed
// external clients, no silent failures). Contract:
// specs/009-secure-n8n-proxy/contracts/flow-config.md
// The token is write-only: getFlowConfig never returns the token value.

export type FlowType = 'rag_chat' | 'document_processing'

export interface FlowConfigInfo {
  flow_type: FlowType
  webhook_url: string
  webhook_auth_header: string
  has_token: boolean
}

export interface FlowConfigTestResult {
  ok: boolean
  status: number
  message: string
}

export type FlowConfigErrorCode = 'UNAUTHORIZED' | 'FORBIDDEN' | 'VALIDATION' | 'UPSTREAM_ERROR'

export class FlowConfigClientError extends Error {
  readonly code: FlowConfigErrorCode
  constructor(code: FlowConfigErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

const TEXT_UNAUTHORIZED = 'Uw sessie is verlopen. Log opnieuw in.'
const TEXT_FORBIDDEN = 'U heeft geen beheerdersrechten voor deze instelling.'
const TEXT_VALIDATION = 'Ongeldige invoer. Voer een geldige https-URL in.'
const TEXT_UPSTREAM_ERROR = 'Er ging iets mis bij het opslaan. Probeer het opnieuw.'

async function toFlowConfigClientError(err: unknown): Promise<FlowConfigClientError> {
  if (err instanceof FunctionsHttpError) {
    const body = await err.context.json().catch(() => null) as { code?: string; message?: string } | null
    const code = body?.code
    if (code === 'UNAUTHORIZED') return new FlowConfigClientError('UNAUTHORIZED', body?.message || TEXT_UNAUTHORIZED)
    if (code === 'FORBIDDEN') return new FlowConfigClientError('FORBIDDEN', body?.message || TEXT_FORBIDDEN)
    if (code === 'VALIDATION') return new FlowConfigClientError('VALIDATION', body?.message || TEXT_VALIDATION)
    return new FlowConfigClientError('UPSTREAM_ERROR', body?.message || TEXT_UPSTREAM_ERROR)
  }
  if (err instanceof FunctionsRelayError || err instanceof FunctionsFetchError) {
    return new FlowConfigClientError('UPSTREAM_ERROR', TEXT_UPSTREAM_ERROR)
  }
  return new FlowConfigClientError('UPSTREAM_ERROR', TEXT_UPSTREAM_ERROR)
}

async function invokeFlowConfig<T>(payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('flow-config', { body: payload })
  if (error) throw await toFlowConfigClientError(error)
  return data as T
}

export async function getFlowConfig(flowType: FlowType): Promise<FlowConfigInfo> {
  return invokeFlowConfig<FlowConfigInfo>({ action: 'get', flow_type: flowType })
}

export async function saveFlowConfig(
  flowType: FlowType,
  input: {
    webhook_url: string
    webhook_auth_header: string
    webhook_token?: string
  },
): Promise<{ ok: true; has_token: boolean }> {
  const body: Record<string, unknown> = {
    action: 'save',
    flow_type: flowType,
    webhook_url: input.webhook_url,
    webhook_auth_header: input.webhook_auth_header,
  }
  if (input.webhook_token) body.webhook_token = input.webhook_token
  return invokeFlowConfig<{ ok: true; has_token: boolean }>(body)
}

export async function testFlowConfig(
  flowType: FlowType,
  input: {
    webhook_url: string
    webhook_auth_header?: string
    webhook_token?: string
  },
): Promise<FlowConfigTestResult> {
  const body: Record<string, unknown> = {
    action: 'test',
    flow_type: flowType,
    webhook_url: input.webhook_url,
  }
  if (input.webhook_auth_header) body.webhook_auth_header = input.webhook_auth_header
  if (input.webhook_token) body.webhook_token = input.webhook_token
  return invokeFlowConfig<FlowConfigTestResult>(body)
}