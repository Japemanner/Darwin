import {
  FunctionsHttpError,
  FunctionsRelayError,
  FunctionsFetchError,
} from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { KnowledgeBaseDocument } from '@/types/database.types'

export type DocumentWebhookAction = 'index' | 'modify' | 'delete'

export class DocumentWebhookError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

// Carries the created document id when the row exists but the indexing call
// failed, so the UI retries indexing instead of uploading a duplicate.
export class DocumentUploadError extends Error {
  readonly documentId: string | null
  constructor(message: string, documentId: string | null) {
    super(message)
    this.documentId = documentId
  }
}

const TEXT_UNAUTHORIZED = 'Uw sessie is verlopen. Log opnieuw in.'
const TEXT_FORBIDDEN = 'U heeft geen toegang tot dit document.'
const TEXT_NOT_CONFIGURED = 'Er is geen koppeling geconfigureerd. Neem contact op met de beheerder.'
const TEXT_UPSTREAM_AUTH = 'De koppeling weigert de verbinding. Controleer het token en de headernaam in de instellingen.'
const TEXT_UPSTREAM_ERROR = 'De documentverwerking gaf een fout. Probeer het opnieuw of neem contact op met de beheerder.'
const TEXT_UPSTREAM_TIMEOUT = 'De documentverwerking reageert niet binnen de toegestane tijd. Probeer het opnieuw.'
const TEXT_UPSTREAM_UNREACHABLE = 'Kon geen verbinding maken met de documentverwerking.'

const EDGE_ERROR_TEXTS: Record<string, string> = {
  UNAUTHORIZED: TEXT_UNAUTHORIZED,
  FORBIDDEN: TEXT_FORBIDDEN,
  NOT_CONFIGURED: TEXT_NOT_CONFIGURED,
  UPSTREAM_AUTH: TEXT_UPSTREAM_AUTH,
  UPSTREAM_ERROR: TEXT_UPSTREAM_ERROR,
  UPSTREAM_TIMEOUT: TEXT_UPSTREAM_TIMEOUT,
  UPSTREAM_UNREACHABLE: TEXT_UPSTREAM_UNREACHABLE,
}

async function toDocumentWebhookError(err: unknown): Promise<DocumentWebhookError> {
  if (err instanceof FunctionsHttpError) {
    const body = await err.context.json().catch(() => null) as { code?: string; message?: string } | null
    const code = body?.code ?? 'UPSTREAM_ERROR'
    const message = body?.message ?? EDGE_ERROR_TEXTS[code] ?? TEXT_UPSTREAM_ERROR
    return new DocumentWebhookError(code, message)
  }
  if (err instanceof FunctionsRelayError || err instanceof FunctionsFetchError) {
    return new DocumentWebhookError('UPSTREAM_UNREACHABLE', TEXT_UPSTREAM_UNREACHABLE)
  }
  return new DocumentWebhookError('UPSTREAM_ERROR', TEXT_UPSTREAM_ERROR)
}

async function notifyDocumentWebhook(documentId: string, action: DocumentWebhookAction): Promise<void> {
  const { error } = await supabase.functions.invoke('document-webhook', {
    body: { document_id: documentId, action },
  })
  if (error) throw await toDocumentWebhookError(error)
}

export const uploadDocument = async (
  file: File,
  knowledgeBaseId: string,
  userId: string,
  organizationId: string
): Promise<KnowledgeBaseDocument> => {
  const fileExt = file.name.split('.').pop()
  const filePath = `${organizationId}/${knowledgeBaseId}/${crypto.randomUUID()}.${fileExt}`

  const { error: uploadError } = await supabase.storage
    .from('knowledge-documents')
    .upload(filePath, file)

  if (uploadError) throw uploadError

  const { data: document, error: insertError } = await supabase
    .from('knowledge_base_documents')
    .insert({
      knowledge_base_id: knowledgeBaseId,
      organization_id: organizationId,
      name: file.name,
      file_path: filePath,
      file_type: fileExt || 'unknown',
      file_size: file.size,
      status: 'processing',
      created_by: userId,
    })
    .select()
    .single()

  if (insertError) throw insertError

  // Notify n8n via the server. On failure the file and row stay in place and
  // the caller shows the Dutch error message (constitution V: no silent failures).
  try {
    await notifyDocumentWebhook(document.id, 'index')
  } catch (err) {
    throw new DocumentUploadError(
      err instanceof Error ? err.message : TEXT_UPSTREAM_ERROR,
      document.id,
    )
  }

  return document
}

// Re-indexing is a server-side status transition: the edge function sets
// status = 'processing' and clears error_message before calling n8n. Clients
// have no UPDATE policy on knowledge_base_documents (migration 015).
export const retryDocument = async (documentId: string): Promise<void> => {
  await notifyDocumentWebhook(documentId, 'index')
}

export const deleteDocument = async (documentId: string, filePath: string | null) => {
  // Notify n8n FIRST — the server needs the row to exist to resolve the
  // organization, knowledge base and the signed download URL. On failure the
  // document stays stored (spec US2 scenario 3).
  await notifyDocumentWebhook(documentId, 'delete')

  if (filePath) {
    const { error: storageError } = await supabase.storage
      .from('knowledge-documents')
      .remove([filePath])

    if (storageError) throw storageError
  }

  const { error } = await supabase
    .from('knowledge_base_documents')
    .delete()
    .eq('id', documentId)

  if (error) throw error
}