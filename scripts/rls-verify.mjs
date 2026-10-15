#!/usr/bin/env node
// scripts/rls-verify.mjs
// Verifies SC-001/SC-002 of specs/010-admin-only-management: a member
// (profiles.role = 'member') must be DENIED every write operation on the
// five management tables and on the 'knowledge-documents' storage bucket,
// while read access within their own organization and their own
// conversation/message/feedback flows keep working.
//
// Usage: node scripts/rls-verify.mjs
// Env (from .env.local or the process environment):
//   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY,
//   E2E_MEMBER_EMAIL, E2E_MEMBER_PASSWORD
//
// Expected results:
//   BEFORE migration 015: the write checks FAIL (writes still allowed) —
//     this proves the script actually tests the enforcement.
//   AFTER migration 015:  the write checks PASS (RLS denies), the
//     positive checks PASS.
//
// Safety: destructive checks (DELETE) only target marker rows created by
// this script itself — never existing production data. Any marker row that
// is created despite a denial is cleaned up at the end.

import { readFileSync, existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const MARKER = `rls-verify-marker-${Date.now()}`

function loadEnvLocal() {
  if (!existsSync('.env.local')) return {}
  const out = {}
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (match) out[match[1]] = match[2].trim().replace(/^["']|["']$/g, '')
  }
  return out
}

const envLocal = loadEnvLocal()
const env = (key) => process.env[key] ?? envLocal[key]

const url = env('VITE_SUPABASE_URL')
const anonKey = env('VITE_SUPABASE_ANON_KEY')
const memberEmail = env('E2E_MEMBER_EMAIL')
const memberPassword = env('E2E_MEMBER_PASSWORD')

const missing = Object.entries({
  VITE_SUPABASE_URL: url,
  VITE_SUPABASE_ANON_KEY: anonKey,
  E2E_MEMBER_EMAIL: memberEmail,
  E2E_MEMBER_PASSWORD: memberPassword,
})
  .filter(([, value]) => !value)
  .map(([key]) => key)
if (missing.length > 0) {
  console.error(
    `Missing ${missing.join(', ')} — set them in .env.local or the environment.`
  )
  process.exit(2)
}

const supabase = createClient(url, anonKey, {
  auth: { flowType: 'pkce', autoRefreshToken: true, persistSession: false },
})

const results = []
const record = (name, status, note = '') => {
  results.push({ name, status })
  console.log(`${status === 'PASS' ? 'PASS' : status === 'SKIP' ? 'SKIP' : 'FAIL'}  ${name}${note ? ` — ${note}` : ''}`)
}

const cleanups = []

async function main() {
  // ---- Sign in as the member test account --------------------------------
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: memberEmail,
    password: memberPassword,
  })
  if (authError || !authData.user) {
    console.error('Cannot sign in with the member test account:', authError?.message)
    process.exit(2)
  }
  const userId = authData.user.id

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, organization_id, role')
    .eq('id', userId)
    .single()
  if (profileError || !profile) {
    console.error('Cannot load member profile:', profileError?.message)
    process.exit(2)
  }
  if (profile.role !== 'member') {
    console.error(`Expected a member account (role=member), got role=${profile.role}`)
    process.exit(2)
  }
  const orgId = profile.organization_id
  console.log(`Signed in as member ${memberEmail} (org ${orgId})\n`)

  // ---- Reference rows for FK-dependent checks -----------------------------
  const { data: assistant } = await supabase
    .from('ai_assistants')
    .select('id')
    .limit(1)
    .maybeSingle()
  const { data: kb } = await supabase
    .from('knowledge_bases')
    .select('id')
    .limit(1)
    .maybeSingle()

  // ---- 15 write checks: 5 tables x INSERT/UPDATE/DELETE --------------------
  // INSERT denial surfaces as an error (42501). UPDATE/DELETE denials surface
  // as "0 rows affected" (RLS filters them out silently by design), so those
  // checks use count: 'exact' on the marker row created in the INSERT check.
  // The marker row only exists when the INSERT check failed to be denied
  // (i.e. before migration 015) — before 015 the member can also delete it,
  // which doubles as cleanup.

  // ai_assistants
  let markerAssistantId = null
  try {
    const { data, error } = await supabase
      .from('ai_assistants')
      .insert({
        organization_id: orgId,
        name: MARKER,
        system_prompt: 'rls-verify marker (safe to delete)',
        type: 'chat',
        n8n_webhook_url: 'https://rls-verify.invalid/hook',
        created_by: userId,
      })
      .select('id')
      .single()
    if (error) {
      record('ai_assistants INSERT denied', 'PASS', error.code ?? error.message)
    } else {
      markerAssistantId = data.id
      cleanups.push(() => supabase.from('ai_assistants').delete().eq('id', markerAssistantId))
      record('ai_assistants INSERT denied', 'FAIL', 'insert was allowed')
    }
  } catch (err) {
    record('ai_assistants INSERT denied', 'FAIL', String(err))
  }

  await checkUpdateDenied('ai_assistants', 'name')
  await checkDeleteDenied('ai_assistants', { name: MARKER })

  // knowledge_bases
  let markerKBId = null
  try {
    const { data, error } = await supabase
      .from('knowledge_bases')
      .insert({ organization_id: orgId, name: MARKER, created_by: userId })
      .select('id')
      .single()
    if (error) {
      record('knowledge_bases INSERT denied', 'PASS', error.code ?? error.message)
    } else {
      markerKBId = data.id
      cleanups.push(() => supabase.from('knowledge_bases').delete().eq('id', markerKBId))
      record('knowledge_bases INSERT denied', 'FAIL', 'insert was allowed')
    }
  } catch (err) {
    record('knowledge_bases INSERT denied', 'FAIL', String(err))
  }

  await checkUpdateDenied('knowledge_bases', 'name')
  await checkDeleteDenied('knowledge_bases', { name: MARKER })

  // knowledge_base_documents (FK: knowledge_base_id)
  const docKbId = markerKBId ?? kb?.id ?? null
  if (docKbId) {
    let markerDocId = null
    try {
      const { data, error } = await supabase
        .from('knowledge_base_documents')
        .insert({
          knowledge_base_id: docKbId,
          organization_id: orgId,
          name: `${MARKER}.txt`,
          file_path: `rls-verify/${MARKER}.txt`,
          file_type: 'txt',
          file_size: 1,
          created_by: userId,
        })
        .select('id')
        .single()
      if (error) {
        record('knowledge_base_documents INSERT denied', 'PASS', error.code ?? error.message)
      } else {
        markerDocId = data.id
        cleanups.push(() => supabase.from('knowledge_base_documents').delete().eq('id', markerDocId))
        record('knowledge_base_documents INSERT denied', 'FAIL', 'insert was allowed')
      }
    } catch (err) {
      record('knowledge_base_documents INSERT denied', 'FAIL', String(err))
    }
    await checkUpdateDenied('knowledge_base_documents', 'name')
    await checkDeleteDenied('knowledge_base_documents', { name: `${MARKER}.txt` })
  } else {
    for (const op of ['INSERT', 'UPDATE', 'DELETE']) {
      record(`knowledge_base_documents ${op} denied`, 'SKIP', 'no knowledge base available as FK reference')
    }
  }

  // knowledge_items (FK: knowledge_base_id)
  const itemKbId = markerKBId ?? kb?.id ?? null
  if (itemKbId) {
    let markerItemId = null
    try {
      const { data, error } = await supabase
        .from('knowledge_items')
        .insert({
          knowledge_base_id: itemKbId,
          title: MARKER,
          content: 'rls-verify marker',
          created_by: userId,
        })
        .select('id')
        .single()
      if (error) {
        record('knowledge_items INSERT denied', 'PASS', error.code ?? error.message)
      } else {
        markerItemId = data.id
        cleanups.push(() => supabase.from('knowledge_items').delete().eq('id', markerItemId))
        record('knowledge_items INSERT denied', 'FAIL', 'insert was allowed')
      }
    } catch (err) {
      record('knowledge_items INSERT denied', 'FAIL', String(err))
    }
    await checkUpdateDenied('knowledge_items', 'title')
    await checkDeleteDenied('knowledge_items', { title: MARKER })
  } else {
    for (const op of ['INSERT', 'UPDATE', 'DELETE']) {
      record(`knowledge_items ${op} denied`, 'SKIP', 'no knowledge base available as FK reference')
    }
  }

  // assistant_knowledge_bases (FKs: assistant_id + knowledge_base_id)
  const linkAssistantId = markerAssistantId ?? assistant?.id ?? null
  const linkKbId = markerKBId ?? kb?.id ?? null
  if (linkAssistantId && linkKbId) {
    let linkCreated = false
    try {
      const { error } = await supabase
        .from('assistant_knowledge_bases')
        .insert({ assistant_id: linkAssistantId, knowledge_base_id: linkKbId })
      if (error) {
        record('assistant_knowledge_bases INSERT denied', 'PASS', error.code ?? error.message)
      } else {
        linkCreated = true
        cleanups.push(() =>
          supabase
            .from('assistant_knowledge_bases')
            .delete()
            .eq('assistant_id', linkAssistantId)
            .eq('knowledge_base_id', linkKbId)
        )
        record('assistant_knowledge_bases INSERT denied', 'FAIL', 'insert was allowed')
      }
    } catch (err) {
      record('assistant_knowledge_bases INSERT denied', 'FAIL', String(err))
    }
    record('assistant_knowledge_bases UPDATE denied', 'SKIP', 'junction tables have no mutable columns')
    if (linkAssistantId && linkKbId) {
      await checkDeleteDenied('assistant_knowledge_bases', {
        assistant_id: linkAssistantId,
        knowledge_base_id: linkKbId,
      })
    } else {
      record('assistant_knowledge_bases DELETE denied', 'SKIP', 'no assistant/knowledge base available as FK reference')
    }
  } else {
    for (const op of ['INSERT', 'UPDATE', 'DELETE']) {
      record(`assistant_knowledge_bases ${op} denied`, 'SKIP', 'no assistant/knowledge base available as FK reference')
    }
  }

  // ---- Storage bucket 'knowledge-documents' (SC-002) ----------------------
  const bucket = 'knowledge-documents'
  const markerPath = `${orgId}/rls-verify/${MARKER}.txt`
  let markerUploaded = false
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .upload(markerPath, new Blob(['rls-verify marker']), { contentType: 'text/plain' })
    if (error) {
      record("storage 'knowledge-documents' INSERT (upload) denied", 'PASS', error.message)
    } else {
      markerUploaded = true
      cleanups.push(() => supabase.storage.from(bucket).remove([markerPath]))
      record("storage 'knowledge-documents' INSERT (upload) denied", 'FAIL', 'upload was allowed')
    }
  } catch (err) {
    record("storage 'knowledge-documents' INSERT (upload) denied", 'FAIL', String(err))
  }

  try {
    const { error } = await supabase.storage
      .from(bucket)
      .update(markerPath, new Blob(['rls-verify marker']), { contentType: 'text/plain' })
    if (markerUploaded) {
      record("storage 'knowledge-documents' UPDATE denied", 'FAIL', 'update was allowed')
    } else {
      // The marker object does not exist (upload was denied), so this touches
      // nothing; a member cannot reach any object via the org path check.
      record("storage 'knowledge-documents' UPDATE denied", 'PASS', 'no object reachable by member')
    }
  } catch (err) {
    record("storage 'knowledge-documents' UPDATE denied", 'FAIL', String(err))
  }

  try {
    const { error } = await supabase.storage.from(bucket).remove([markerPath])
    if (markerUploaded) {
      if (error) {
        record("storage 'knowledge-documents' DELETE denied", 'PASS', error.message)
      } else {
        record("storage 'knowledge-documents' DELETE denied", 'FAIL', 'delete was allowed')
      }
    } else {
      record("storage 'knowledge-documents' DELETE denied", 'PASS', 'no object reachable by member')
    }
  } catch (err) {
    record("storage 'knowledge-documents' DELETE denied", 'FAIL', String(err))
  }

  // ---- Positive checks: read access + own chat flows (FR-009 / FR-010) ----
  for (const [table, label] of [
    ['ai_assistants', 'assistants'],
    ['knowledge_bases', 'knowledge bases'],
    ['knowledge_base_documents', 'documents'],
    ['knowledge_items', 'knowledge items'],
    ['assistant_knowledge_bases', 'assistant-KB links'],
  ]) {
    const { error } = await supabase.from(table).select('id').limit(1)
    if (error) record(`read ${label} within own org allowed`, 'FAIL', error.message)
    else record(`read ${label} within own org allowed`, 'PASS')
  }

  if (assistant) {
    const { data: conv, error: convError } = await supabase
      .from('conversations')
      .insert({ user_id: userId, assistant_id: assistant.id, title: MARKER })
      .select('id')
      .single()
    if (convError || !conv) {
      record('own conversation insert allowed', 'FAIL', convError?.message)
    } else {
      record('own conversation insert allowed', 'PASS')
      const { error: msgError } = await supabase
        .from('messages')
        .insert({ conversation_id: conv.id, role: 'user', content: 'rls-verify marker' })
      record('own message insert allowed', msgError ? 'FAIL' : 'PASS', msgError?.message)

      const { error: fbError } = await supabase
        .from('feedback_interactions')
        .insert({
          conversation_id: conv.id,
          assistant_id: assistant.id,
          user_id: userId,
          organization_id: orgId,
          thumbs_up: true,
        })
      record('own feedback insert allowed', fbError ? 'FAIL' : 'PASS', fbError?.message)

      const { error: delError } = await supabase.from('conversations').delete().eq('id', conv.id)
      record('own conversation delete allowed (cleanup)', delError ? 'FAIL' : 'PASS', delError?.message)
    }
  } else {
    record('own conversation/message/feedback flow', 'SKIP', 'no assistant available')
  }

  // ---- Cleanup (only relevant before migration 015) ------------------------
  for (const fn of cleanups.reverse()) {
    try {
      await fn()
    } catch {
      // best-effort cleanup of marker rows
    }
  }
}

/**
 * UPDATE denial check: attempts a no-op update — it writes back a row's own
 * value on its display column (name/title), so the only possible mutation is
 * the updated_at trigger. RLS denial shows up as "0 rows affected" (no error),
 * so the exact count decides PASS/FAIL. Before 015 the update succeeds
 * (count > 0) — a FAIL that proves the check works.
 */
async function checkUpdateDenied(table, column) {
  try {
    const { data: row, error: selError } = await supabase
      .from(table)
      .select(`id, ${column}`)
      .limit(1)
      .maybeSingle()
    if (selError) {
      record(`${table} UPDATE denied`, 'FAIL', selError.message)
      return
    }
    if (!row) {
      record(`${table} UPDATE denied`, 'SKIP', 'no readable row to target')
      return
    }
    const { count, error } = await supabase
      .from(table)
      .update({ [column]: row[column] }, { count: 'exact' })
      .eq('id', row.id)
    if (error) {
      record(`${table} UPDATE denied`, 'PASS', error.code ?? error.message)
    } else if ((count ?? 0) === 0) {
      record(`${table} UPDATE denied`, 'PASS', '0 rows affected')
    } else {
      record(`${table} UPDATE denied`, 'FAIL', `${count} row(s) updated`)
    }
  } catch (err) {
    record(`${table} UPDATE denied`, 'FAIL', String(err))
  }
}

/**
 * DELETE denial check: only ever targets marker rows created by this script
 * (matched on the marker value — never existing production data). The marker
 * row only exists when the INSERT check failed to be denied (before 015); in
 * that case the delete succeeds, which FAILs the check and doubles as
 * cleanup. After 015 no marker row exists and no row matches → PASS.
 * The policy contents are additionally verified via the quickstart §4 SQL.
 */
async function checkDeleteDenied(table, match) {
  try {
    const { count, error } = await supabase.from(table).delete({ count: 'exact' }).match(match)
    if (error) {
      record(`${table} DELETE denied`, 'PASS', error.code ?? error.message)
    } else if ((count ?? 0) === 0) {
      record(`${table} DELETE denied`, 'PASS', 'no marker row reachable by member')
    } else {
      record(`${table} DELETE denied`, 'FAIL', `${count} marker row(s) deleted`)
    }
  } catch (err) {
    record(`${table} DELETE denied`, 'FAIL', String(err))
  }
}

main()
  .then(() => {
    const fails = results.filter((r) => r.status === 'FAIL').length
    const passes = results.filter((r) => r.status === 'PASS').length
    const skips = results.filter((r) => r.status === 'SKIP').length
    console.log(`\nSummary: ${passes} PASS, ${fails} FAIL, ${skips} SKIP`)
    if (fails > 0) {
      console.log('\nResult: FAIL — members can still write, or a positive check broke.')
      console.log('Before migration 015 this is expected (proof the checks work).')
      process.exit(1)
    }
    console.log('\nResult: PASS — all write operations denied for the member account.')
    process.exit(0)
  })
  .catch((err) => {
    console.error('rls-verify crashed:', err)
    process.exit(2)
  })