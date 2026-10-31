import {
  FunctionsHttpError,
  FunctionsRelayError,
  FunctionsFetchError,
} from '@supabase/supabase-js'
import { supabase } from './supabase'

// Typed client for the team-admin Edge Function (constitution V: typed external
// clients, no silent failures).
// Contract: specs/020-team-management/contracts/team-admin.md

export type TeamRole = 'admin' | 'member'
export type TeamStatus = 'invited' | 'active' | 'blocked'

export interface TeamMember {
  id: string
  full_name: string
  email: string
  role: TeamRole
  status: TeamStatus
  created_at: string
  is_self: boolean
  is_protected: boolean
}

export interface InviteMemberInput {
  email: string
  full_name: string
  role: TeamRole
}

export type TeamAdminErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL_ERROR'

export class TeamAdminClientError extends Error {
  readonly code: TeamAdminErrorCode

  constructor(code: TeamAdminErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

const TEXT_UNAUTHORIZED = 'Uw sessie is verlopen. Log opnieuw in.'
const TEXT_FORBIDDEN = 'U heeft geen rechten voor deze actie.'
const TEXT_VALIDATION = 'Ongeldige invoer.'
const TEXT_NOT_FOUND = 'Dit teamlid bestaat niet in deze organisatie.'
const TEXT_CONFLICT = 'De actie kon niet worden uitgevoerd.'
const TEXT_INTERNAL = 'Er ging iets mis. Probeer het opnieuw.'

async function toTeamAdminError(err: unknown): Promise<TeamAdminClientError> {
  if (err instanceof FunctionsHttpError) {
    const body = await err.context.json().catch(() => null) as
      | { code?: string; message?: string }
      | null
    const code = body?.code
    if (code === 'UNAUTHORIZED') {
      return new TeamAdminClientError('UNAUTHORIZED', body?.message || TEXT_UNAUTHORIZED)
    }
    if (code === 'FORBIDDEN') {
      return new TeamAdminClientError('FORBIDDEN', body?.message || TEXT_FORBIDDEN)
    }
    if (code === 'VALIDATION') {
      return new TeamAdminClientError('VALIDATION', body?.message || TEXT_VALIDATION)
    }
    if (code === 'NOT_FOUND') {
      return new TeamAdminClientError('NOT_FOUND', body?.message || TEXT_NOT_FOUND)
    }
    if (code === 'CONFLICT') {
      return new TeamAdminClientError('CONFLICT', body?.message || TEXT_CONFLICT)
    }
    return new TeamAdminClientError('INTERNAL_ERROR', body?.message || TEXT_INTERNAL)
  }
  if (err instanceof FunctionsRelayError || err instanceof FunctionsFetchError) {
    return new TeamAdminClientError('INTERNAL_ERROR', TEXT_INTERNAL)
  }
  return new TeamAdminClientError('INTERNAL_ERROR', TEXT_INTERNAL)
}

async function invokeTeamAdmin<T>(payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('team-admin', { body: payload })
  if (error) throw await toTeamAdminError(error)
  return data as T
}

export async function listMembers(organizationId: string): Promise<TeamMember[]> {
  return invokeTeamAdmin<TeamMember[]>({
    action: 'list_members',
    organization_id: organizationId,
  })
}

export async function inviteMember(
  organizationId: string,
  input: InviteMemberInput,
): Promise<TeamMember> {
  const data = await invokeTeamAdmin<{ member: TeamMember }>({
    action: 'invite',
    organization_id: organizationId,
    email: input.email,
    full_name: input.full_name,
    role: input.role,
  })
  return data.member
}

export async function resendInvite(
  organizationId: string,
  userId: string,
): Promise<void> {
  await invokeTeamAdmin<{ ok: true }>({
    action: 'resend_invite',
    organization_id: organizationId,
    user_id: userId,
  })
}

export async function revokeInvite(
  organizationId: string,
  userId: string,
): Promise<void> {
  await invokeTeamAdmin<{ ok: true }>({
    action: 'revoke_invite',
    organization_id: organizationId,
    user_id: userId,
  })
}

export async function setMemberRole(
  organizationId: string,
  userId: string,
  role: TeamRole,
): Promise<TeamMember> {
  const data = await invokeTeamAdmin<{ member: TeamMember }>({
    action: 'set_role',
    organization_id: organizationId,
    user_id: userId,
    role,
  })
  return data.member
}

export async function blockMember(
  organizationId: string,
  userId: string,
): Promise<TeamMember> {
  const data = await invokeTeamAdmin<{ member: TeamMember }>({
    action: 'block',
    organization_id: organizationId,
    user_id: userId,
  })
  return data.member
}

export async function unblockMember(
  organizationId: string,
  userId: string,
): Promise<TeamMember> {
  const data = await invokeTeamAdmin<{ member: TeamMember }>({
    action: 'unblock',
    organization_id: organizationId,
    user_id: userId,
  })
  return data.member
}
