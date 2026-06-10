import { supabase } from './supabase'
import { callDocumentWebhook } from './webhook'
import type { KnowledgeBaseDocument } from '@/types/database.types'

export const uploadDocument = async (
  file: File,
  knowledgeBaseId: string,
  knowledgeBaseName: string,
  userId: string,
  organizationId: string
): Promise<{ document: KnowledgeBaseDocument; signedUrl: string }> => {
  const fileExt = file.name.split('.').pop()
  const filePath = `${organizationId}/${knowledgeBaseId}/${crypto.randomUUID()}.${fileExt}`

  const { error: uploadError } = await supabase.storage
    .from('knowledge-documents')
    .upload(filePath, file)

  if (uploadError) throw uploadError

  const { data: document, error: insertError } = await (supabase as any) // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase type inference limitation
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

  const { data: signedUrlData } = await supabase.storage
    .from('knowledge-documents')
    .createSignedUrl(filePath, 900)

  if (!signedUrlData?.signedUrl) throw new Error('Failed to generate signed URL')

  await callDocumentWebhook(
    organizationId,
    knowledgeBaseName,
    (document as KnowledgeBaseDocument).id,
    file.name,
    fileExt?.toLowerCase() || 'unknown',
    signedUrlData.signedUrl,
    'index',
    filePath,
  )

  return { document, signedUrl: signedUrlData.signedUrl }
}

export const deleteDocument = async (
  documentId: string,
  filePath: string | null,
  organizationId: string,
  knowledgeBaseName: string,
  documentName: string,
) => {
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

  const fileExt = filePath?.split('.').pop()?.toLowerCase() || 'unknown'
  await callDocumentWebhook(organizationId, knowledgeBaseName, documentId, documentName, fileExt, '', 'delete', filePath ?? '')
}