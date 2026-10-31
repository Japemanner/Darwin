import {
  FunctionsHttpError,
  FunctionsRelayError,
  FunctionsFetchError,
} from '@supabase/supabase-js'
import { supabase } from './supabase'

// Typed client for the platform-admin Edge Function (constitution V: typed
// external clients, no silent failures).
// Contract: specs/019-platform-assistant-catalog/contracts/platform-admin.md
// The webhook token is write-only: getConnections never returns the value.

export interface OrganizationOption {
  id: string
  name: string
}

export interface OrgAssistant {
  assistant_id: string
  catalog_id: string
  name: string
  icon: string
  type: string
  is_active: boolean
}

export interface ConnectionAssistant {
  catalog_id: string
  name: string
  type: string
  test_webhook_url: string | null
  prod_webhook_url: string | null
}

export interface ConnectionsInfo {
  auth_header: string
  has_token: boolean
  document_webhook_url: string | null
  assistants: ConnectionAssistant[]
}

export interface SaveConnectionsInput {
  auth_header: string
  // Empty or absent keeps the existing token.
  token?: string
  document_webhook_url: string | null
  assistants: Array<{
    catalog_id: string
    test_webhook_url: string | null
    prod_webhook_url: string | null
  }>
}

export interface ConnectionTestResult {
  ok: boolean
  status: number
  message: string
}

export interface SaveCatalogAssistantInput {
  id: string | null
  name: string
  description: string | null
  icon: string
  type: string
  example_questions: string[]
}

export type PlatformAdminErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'VALIDATION'
  | 'INTERNAL_ERROR'

export class PlatformAdminClientError extends Error {
  readonly code: PlatformAdminErrorCode
  constructor(code: PlatformAdminErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

const TEXT_UNAUTHORIZED = 'Uw sessie is verlopen. Log opnieuw in.'
const TEXT_FORBIDDEN = 'Alleen de platformbeheerder kan deze instelling wijzigen.'
const TEXT_VALIDATION = 'Ongeldige invoer.'
const TEXT_INTERNAL = 'Er ging iets mis. Probeer het opnieuw.'

async function toPlatformAdminError(err: unknown): Promise<PlatformAdminClientError> {
  if (err instanceof FunctionsHttpError) {
    const body = await err.context.json().catch(() => null) as
      | { code?: string; message?: string }
      | null
    const code = body?.code
    if (code === 'UNAUTHORIZED') {
      return new PlatformAdminClientError('UNAUTHORIZED', body?.message || TEXT_UNAUTHORIZED)
    }
    if (code === 'FORBIDDEN') {
      return new PlatformAdminClientError('FORBIDDEN', body?.message || TEXT_FORBIDDEN)
    }
    if (code === 'VALIDATION') {
      return new PlatformAdminClientError('VALIDATION', body?.message || TEXT_VALIDATION)
    }
    return new PlatformAdminClientError('INTERNAL_ERROR', body?.message || TEXT_INTERNAL)
  }
  if (err instanceof FunctionsRelayError || err instanceof FunctionsFetchError) {
    return new PlatformAdminClientError('INTERNAL_ERROR', TEXT_INTERNAL)
  }
  return new PlatformAdminClientError('INTERNAL_ERROR', TEXT_INTERNAL)
}

async function invokePlatformAdmin<T>(payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('platform-admin', { body: payload })
  if (error) throw await toPlatformAdminError(error)
  return data as T
}

export async function listOrganizations(): Promise<OrganizationOption[]> {
  return invokePlatformAdmin<OrganizationOption[]>({ action: 'list_organizations' })
}

export async function listOrgAssistants(organizationId: string): Promise<OrgAssistant[]> {
  return invokePlatformAdmin<OrgAssistant[]>({
    action: 'list_org_assistants',
    organization_id: organizationId,
  })
}

export async function setAssistantActive(
  organizationId: string,
  catalogId: string,
  isActive: boolean,
): Promise<void> {
  await invokePlatformAdmin<{ ok: true }>({
    action: 'set_assistant_active',
    organization_id: organizationId,
    catalog_id: catalogId,
    is_active: isActive,
  })
}

export async function getConnections(): Promise<ConnectionsInfo> {
  return invokePlatformAdmin<ConnectionsInfo>({ action: 'get_connections' })
}

export async function saveConnections(
  input: SaveConnectionsInput,
): Promise<{ ok: true; has_token: boolean }> {
  const body: Record<string, unknown> = {
    action: 'save_connections',
    auth_header: input.auth_header,
    document_webhook_url: input.document_webhook_url,
    assistants: input.assistants,
  }
  if (input.token) body.token = input.token
  return invokePlatformAdmin<{ ok: true; has_token: boolean }>(body)
}

export async function testConnection(url: string): Promise<ConnectionTestResult> {
  return invokePlatformAdmin<ConnectionTestResult>({
    action: 'test_connection',
    url,
  })
}

export async function saveCatalogAssistant(
  input: SaveCatalogAssistantInput,
): Promise<{ catalog_id: string }> {
  return invokePlatformAdmin<{ catalog_id: string }>({
    action: 'save_catalog_assistant',
    id: input.id,
    name: input.name,
    description: input.description,
    icon: input.icon,
    type: input.type,
    example_questions: input.example_questions,
  })
}
