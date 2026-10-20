import { existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

// Feature 012 — seeding helpers for the per-answer feedback e2e spec
// (specs/012-per-answer-feedback/, research.md #12).
//
// IMPORTANT — import order contract: this module MUST be imported BEFORE
// './fixtures' in the spec file. It loads .env.local at module level so that
// the fixtures (which read E2E_EMAIL/E2E_PASSWORD at module level) see the
// values too. Static import declarations evaluate in source order.
//
// The seeding writes test data to the real Supabase project via the test
// account's own session (explicit route instruction). Every test deletes its
// conversation in afterEach; the message_id FK (migration 017) cascades
// feedback rows, messages cascade via the conversation FK (001:133).

if (existsSync('.env.local')) process.loadEnvFile('.env.local')

const TITLE_PREFIX = 'E2E feedback per antwoord'

export interface SeededConversation {
  conversationId: string
  question1Id: string
  answer1Id: string
  question2Id: string
  answer2Id: string
}

export interface SeedClient {
  client: SupabaseClient
  userId: string
}

export async function createSeedClient(): Promise<SeedClient | null> {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  const email = process.env.E2E_EMAIL
  const password = process.env.E2E_PASSWORD
  if (!url || !key || !email || !password) return null

  const client = createClient(url, key)
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) return null

  const { data: { user }, error: userError } = await client.auth.getUser()
  if (userError || !user) return null

  return { client, userId: user.id }
}

// Delete leftover conversations from a crashed run (own rows only — RLS).
export async function sweepLeftovers({ client, userId }: SeedClient): Promise<void> {
  const { data } = await client
    .from('conversations')
    .select('id')
    .eq('user_id', userId)
    .like('title', `${TITLE_PREFIX}%`)
  if (data && data.length > 0) {
    await client.from('conversations').delete().in('id', data.map((row) => row.id))
  }
}

// One active assistant of the test account's organization (RLS org read).
export async function findActiveAssistantId({ client }: SeedClient): Promise<string | null> {
  const { data } = await client
    .from('ai_assistants')
    .select('id')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return data?.id ?? null
}

// Seed one conversation with two question/answer pairs so "per answer" is
// provable: rating answer 1 must leave answer 2 unrated.
export async function seedConversation(
  { client, userId }: SeedClient,
  assistantId: string,
): Promise<SeededConversation> {
  const title = `${TITLE_PREFIX} — ${new Date().toISOString()}`
  const { data: conversation, error: conversationError } = await client
    .from('conversations')
    .insert({ user_id: userId, assistant_id: assistantId, title })
    .select('id')
    .single()
  if (conversationError || !conversation) throw conversationError ?? new Error('conversation insert failed')

  const conversationId = conversation.id
  const question1Id = crypto.randomUUID()
  const answer1Id = crypto.randomUUID()
  const question2Id = crypto.randomUUID()
  const answer2Id = crypto.randomUUID()

  const messages = [
    { id: question1Id, conversation_id: conversationId, role: 'user', content: 'E2E vraag 1 — wat dekt de polis?' },
    { id: answer1Id, conversation_id: conversationId, role: 'assistant', content: 'E2E antwoord 1 — de polis dekt schade aan eigendommen.' },
    { id: question2Id, conversation_id: conversationId, role: 'user', content: 'E2E vraag 2 — hoe meld ik schade?' },
    { id: answer2Id, conversation_id: conversationId, role: 'assistant', content: 'E2E antwoord 2 — u meldt schade via het formulier.' },
  ]
  const { error: messagesError } = await client.from('messages').insert(messages)
  if (messagesError) throw messagesError

  return { conversationId, question1Id, answer1Id, question2Id, answer2Id }
}

// One DELETE cascades messages (001:133) and per-answer feedback (017).
export async function deleteConversation({ client }: SeedClient, conversationId: string): Promise<void> {
  await client.from('conversations').delete().eq('id', conversationId)
}

// All per-answer ratings of a seeded conversation (own rows — RLS).
export async function getFeedbackRows(
  { client }: SeedClient,
  conversationId: string,
): Promise<Array<{ message_id: string | null; thumbs_up: boolean; reason: string | null; feedback: string | null }>> {
  const { data, error } = await client
    .from('feedback_interactions')
    .select('message_id, thumbs_up, reason, feedback')
    .eq('conversation_id', conversationId)
    .not('message_id', 'is', null)
  if (error) throw error
  return data ?? []
}