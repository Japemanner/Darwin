import { supabase } from './supabase'

export const uploadDocument = async (
  file: File,
  knowledgeBaseId: string,
  userId: string,
  organizationId: string
) => {
  const fileExt = file.name.split('.').pop()
  const filePath = `${organizationId}/${knowledgeBaseId}/${crypto.randomUUID()}.${fileExt}`

  const { error: uploadError } = await supabase.storage
    .from('knowledge-documents')
    .upload(filePath, file)

  if (uploadError) throw uploadError

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: document, error: insertError } = await (supabase as any)
    .from('knowledge_base_documents')
    .insert({
      knowledge_base_id: knowledgeBaseId,
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

  return document
}

export const getDocumentPublicUrl = (filePath: string) => {
  const { data } = supabase.storage
    .from('knowledge-documents')
    .getPublicUrl(filePath)
  return data.publicUrl
}

export const deleteDocument = async (documentId: string, filePath: string) => {
  const { error: storageError } = await supabase.storage
    .from('knowledge-documents')
    .remove([filePath])

  if (storageError) throw storageError

  const { error } = await supabase
    .from('knowledge_base_documents')
    .delete()
    .eq('id', documentId)

  if (error) throw error
}
