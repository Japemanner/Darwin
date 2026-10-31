import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { uploadDocument, deleteDocument, retryDocument, DocumentUploadError } from '@/lib/storage'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  useKnowledgeBases,
  useKnowledgeBaseDocuments,
  useKnowledgeBaseStats,
  useKnowledgeItems,
  useLinkedAssistants,
  useCreateKnowledgeBase,
  useUpdateKnowledgeBase,
  useAddKnowledgeItem,
  useDeleteKnowledgeItem,
} from '@/hooks/queries'
import { useQueryClient } from '@tanstack/react-query'
import type { KnowledgeBase, KnowledgeBaseDocument, KnowledgeItem } from '@/types/database.types'
import { BookOpen, Plus, FileText, Trash2, Upload, Link2, X } from 'lucide-react'

const ALLOWED_EXTENSIONS = ['pdf', 'txt', 'docx']
const GENERIC_DOCUMENT_ERROR =
  'De verwerking is mislukt. Probeer het opnieuw of neem contact op met de beheerder.'

type UploadStatus = 'waiting' | 'uploading' | 'done' | 'error'

interface UploadItem {
  id: string
  file: File
  status: UploadStatus
  error?: string
  documentId?: string
  retryable?: boolean
}

const UPLOAD_STATUS_LABELS: Record<UploadStatus, string> = {
  waiting: 'Wachten',
  uploading: 'Toevoegen...',
  done: 'Klaar',
  error: 'Fout',
}

type PendingDelete =
  | { type: 'document'; document: KnowledgeBaseDocument }
  | { type: 'item'; item: KnowledgeItem }

function KnowledgePage() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const { data: knowledgeBases, isPending } = useKnowledgeBases(profile?.organization_id)
  const { data: stats } = useKnowledgeBaseStats(profile?.organization_id)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingKB, setEditingKB] = useState<KnowledgeBase | null>(null)
  const [selectedKB, setSelectedKB] = useState<KnowledgeBase | null>(null)

  const statsById = new Map((stats ?? []).map((row) => [row.knowledge_base_id, row]))

  if (isPending) {
    return (
      <div>
        <div className="flex items-center justify-between mb-8">
          <div><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-72 mt-2" /></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardHeader><Skeleton className="h-6 w-32" /></CardHeader><CardContent><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Kennisbronnen</h1>
          <p className="text-muted-foreground">
            {isAdmin ? 'Beheer documenten en koppel ze aan assistenten' : 'Kennisbronnen en documenten van uw organisatie'}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => { setEditingKB(null); setModalOpen(true) }}>
            <Plus className="h-4 w-4 mr-2" /> Nieuwe kennisbron
          </Button>
        )}
      </div>

      {(knowledgeBases ?? []).length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-12 w-12" />}
          title="Nog geen kennisbronnen"
          description={isAdmin ? 'Voeg documenten toe zodat uw assistenten er kennis uit kunnen putten' : 'Nog geen kennisbronnen beschikbaar'}
          {...(isAdmin ? { action: { label: 'Maak kennisbron', onClick: () => { setEditingKB(null); setModalOpen(true) } } } : {})}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(knowledgeBases ?? []).map((kb) => {
            const kbStats = statsById.get(kb.id)
            return (
              <Card key={kb.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedKB(kb)}>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{kb.name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {kb.description ?? 'Geen beschrijving'}
                  </p>
                  <div className="mt-4 space-y-1 text-sm">
                    {kbStats ? (
                      <>
                        <p className="text-foreground">
                          {kbStats.document_count === 0
                            ? 'Nog geen documenten'
                            : formatCount(kbStats.document_count, 'document', 'documenten')}
                        </p>
                        <p className={kbStats.error_count > 0 ? 'font-medium text-destructive' : 'text-muted-foreground'}>
                          {formatCount(kbStats.error_count, 'fout', 'fouten')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Laatst bijgewerkt: {formatDateTime(kbStats.last_updated_at)}
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">Statistieken laden...</p>
                    )}
                  </div>
                </CardContent>
                <CardFooter>
                  {isAdmin && (
                    <Button variant="ghost" size="sm" className="ml-auto" onClick={(e) => { e.stopPropagation(); setEditingKB(kb); setModalOpen(true) }}>
                      Bewerken
                    </Button>
                  )}
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}

      <KBMappingModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        kb={editingKB}
        organizationId={profile?.organization_id ?? ''}
        userId={profile?.id ?? ''}
      />

      <KBSlideOver
        kb={selectedKB}
        onClose={() => setSelectedKB(null)}
        userId={profile?.id ?? ''}
        organizationId={profile?.organization_id ?? ''}
        isAdmin={isAdmin}
      />
    </div>
  )
}

function KBMappingModal({
  open,
  onOpenChange,
  kb,
  organizationId,
  userId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  kb: KnowledgeBase | null
  organizationId: string
  userId: string
}) {
  const { toast } = useToast()
  const createMutation = useCreateKnowledgeBase(organizationId)
  const updateMutation = useUpdateKnowledgeBase(organizationId)
  const { data: kbDocuments, isPending: kbDocumentsLoading } = useKnowledgeBaseDocuments(open ? kb?.id : undefined)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [vectorCollectionId, setVectorCollectionId] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const documentCount = (kbDocuments ?? []).length
  const nameLocked = !!kb && (kbDocumentsLoading || documentCount > 0)

  useEffect(() => {
    if (kb) {
      setName(kb.name)
      setDescription(kb.description ?? '')
      setVectorCollectionId(kb.vector_collection_id ?? '')
    } else {
      setName('')
      setDescription('')
      setVectorCollectionId('')
    }
  }, [kb, open])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    const payload = { organization_id: organizationId, name, description: description || null, vector_collection_id: vectorCollectionId || null, created_by: userId }
    try {
      if (kb) {
        await updateMutation.mutateAsync({ id: kb.id, name: payload.name, description: payload.description, vector_collection_id: payload.vector_collection_id })
        toast({ title: 'Kennisbron bijgewerkt' })
      } else {
        await createMutation.mutateAsync(payload)
        toast({ title: 'Kennisbron aangemaakt' })
      }
      onOpenChange(false)
    } catch (err) {
      toast({ title: 'Fout', description: err instanceof Error ? err.message : 'Onbekende fout', variant: 'destructive' })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <form onSubmit={handleSave}>
        <DialogHeader><DialogTitle>{kb ? 'Kennisbron bewerken' : 'Nieuwe kennisbron'}</DialogTitle></DialogHeader>
        <DialogContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="kb-name">Naam</Label>
            <Input
              id="kb-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mijn kennisbron"
              required
              disabled={nameLocked}
              aria-describedby={nameLocked && !kbDocumentsLoading ? 'kb-name-lock' : undefined}
            />
            {nameLocked && !kbDocumentsLoading && (
              <p id="kb-name-lock" className="text-xs text-muted-foreground">
                De naam kan niet worden gewijzigd zolang er documenten in deze kennisbron staan, omdat de zoekfunctie de naam gebruikt.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="kb-desc">Beschrijving</Label>
            <Textarea id="kb-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optionele omschrijving" rows={3} />
          </div>
        </DialogContent>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
          <Button type="submit" disabled={isSaving}>{isSaving ? 'Opslaan...' : 'Opslaan'}</Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}

function KBSlideOver({
  kb,
  onClose,
  userId,
  organizationId,
  isAdmin,
}: {
  kb: KnowledgeBase | null
  onClose: () => void
  userId: string
  organizationId: string
  isAdmin: boolean
}) {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [tab, setTab] = useState<'documents' | 'items' | 'assistants'>('documents')
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([])
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [itemForm, setItemForm] = useState({ title: '', content: '', sourceUrl: '' })
  const [isSavingItem, setIsSavingItem] = useState(false)

  const { data: documents, isPending: docsLoading } = useKnowledgeBaseDocuments(kb?.id)
  const { data: items, isPending: itemsLoading } = useKnowledgeItems(kb?.id)
  const { data: linkedAssistants } = useLinkedAssistants(kb?.id)
  const addItemMutation = useAddKnowledgeItem(kb?.id ?? '')
  const deleteItemMutation = useDeleteKnowledgeItem(kb?.id ?? '')

  const hasProcessingDocuments = (documents ?? []).some((doc) => doc.status === 'processing')
  const previousHasProcessing = useRef(false)
  useEffect(() => {
    if (previousHasProcessing.current && !hasProcessingDocuments) {
      qc.invalidateQueries({ queryKey: ['kb-stats', organizationId] })
    }
    previousHasProcessing.current = hasProcessingDocuments
  }, [hasProcessingDocuments, organizationId, qc])

  const updateUploadItem = (id: string, patch: Partial<UploadItem>) => {
    setUploadItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  const processUploads = async (itemsToUpload: UploadItem[]) => {
    if (!kb) return
    for (const item of itemsToUpload) {
      updateUploadItem(item.id, { status: 'uploading' })
      try {
        await uploadDocument(item.file, kb.id, userId, organizationId)
        updateUploadItem(item.id, { status: 'done' })
        toast({ title: 'Document toegevoegd', description: item.file.name })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Onbekende fout'
        const documentId = err instanceof DocumentUploadError ? err.documentId ?? undefined : undefined
        updateUploadItem(item.id, { status: 'error', error: message, documentId, retryable: true })
        toast({ title: 'Toevoegen mislukt', description: message, variant: 'destructive' })
      } finally {
        qc.invalidateQueries({ queryKey: ['kb-documents', kb.id] })
        qc.invalidateQueries({ queryKey: ['kb-stats', organizationId] })
      }
    }
  }

  const handleFiles = (files: FileList | File[]) => {
    if (!kb) return
    const list = Array.from(files)
    if (list.length === 0) return

    const allowedText = ALLOWED_EXTENSIONS.join(', ').toUpperCase()
    const newItems: UploadItem[] = list.map((file) => {
      const fileExt = file.name.split('.').pop()?.toLowerCase()
      if (!fileExt || !ALLOWED_EXTENSIONS.includes(fileExt)) {
        return { id: crypto.randomUUID(), file, status: 'error', error: `Toegestane typen: ${allowedText}` }
      }
      return { id: crypto.randomUUID(), file, status: 'waiting' }
    })

    setUploadItems((prev) => [...prev, ...newItems])
    if (newItems.some((item) => item.status === 'error')) {
      toast({ title: 'Ongeldig bestandstype', description: `Toegestane typen: ${allowedText}`, variant: 'destructive' })
    }
    void processUploads(newItems.filter((item) => item.status === 'waiting'))
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files)
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (isAdmin) handleFiles(e.dataTransfer.files)
  }

  const handleRetryUpload = async (item: UploadItem) => {
    if (item.documentId) {
      updateUploadItem(item.id, { status: 'uploading', error: undefined })
      try {
        await retryDocument(item.documentId)
        updateUploadItem(item.id, { status: 'done', documentId: undefined, retryable: false })
        toast({ title: 'Opnieuw in verwerking', description: item.file.name })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Onbekende fout'
        updateUploadItem(item.id, { status: 'error', error: message })
        toast({ title: 'Opnieuw verwerken mislukt', description: message, variant: 'destructive' })
      } finally {
        qc.invalidateQueries({ queryKey: ['kb-documents', kb?.id] })
        qc.invalidateQueries({ queryKey: ['kb-stats', organizationId] })
      }
      return
    }

    updateUploadItem(item.id, { status: 'waiting', error: undefined, retryable: false })
    void processUploads([{ ...item, status: 'waiting', error: undefined, retryable: false }])
  }

  const handleRetryDocument = async (doc: KnowledgeBaseDocument) => {
    setRetryingId(doc.id)
    try {
      await retryDocument(doc.id)
      toast({ title: 'Opnieuw in verwerking', description: doc.name })
      qc.invalidateQueries({ queryKey: ['kb-documents', kb?.id] })
      qc.invalidateQueries({ queryKey: ['kb-stats', organizationId] })
    } catch (err) {
      toast({ title: 'Opnieuw verwerken mislukt', description: err instanceof Error ? err.message : 'Onbekende fout', variant: 'destructive' })
    } finally {
      setRetryingId(null)
    }
  }

  const handleConfirmDelete = async () => {
    if (!pendingDelete || isDeleting) return
    setIsDeleting(true)
    try {
      if (pendingDelete.type === 'document') {
        await deleteDocument(pendingDelete.document.id, pendingDelete.document.file_path)
        toast({ title: 'Document verwijderd' })
        qc.invalidateQueries({ queryKey: ['kb-documents', kb?.id] })
      } else {
        await deleteItemMutation.mutateAsync(pendingDelete.item.id)
        toast({ title: 'Kennisitem verwijderd' })
      }
      qc.invalidateQueries({ queryKey: ['kb-stats', organizationId] })
      setPendingDelete(null)
    } catch (err) {
      toast({ title: 'Fout bij verwijderen', description: err instanceof Error ? err.message : 'Onbekende fout', variant: 'destructive' })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!kb || !itemForm.title.trim() || !itemForm.content.trim() || isSavingItem) return
    setIsSavingItem(true)
    try {
      await addItemMutation.mutateAsync({
        knowledge_base_id: kb.id,
        title: itemForm.title.trim(),
        content: itemForm.content.trim(),
        source_url: itemForm.sourceUrl.trim() || null,
        embedding_status: 'pending',
        created_by: userId,
      })
      toast({ title: 'Kennisitem toegevoegd', description: itemForm.title.trim() })
      setItemForm({ title: '', content: '', sourceUrl: '' })
    } catch (err) {
      toast({ title: 'Fout bij toevoegen', description: err instanceof Error ? err.message : 'Onbekende fout', variant: 'destructive' })
    } finally {
      setIsSavingItem(false)
    }
  }

  if (!kb) return null

  const pendingDeleteName = pendingDelete?.type === 'document'
    ? pendingDelete.document.name
    : pendingDelete?.type === 'item'
      ? pendingDelete.item.title
      : ''

  return (
    <div className="fixed inset-0 z-40">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-background border-l shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold text-lg">{kb.name}</h2>
          <Button variant="ghost" size="icon" aria-label="Sluiten" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>

        <div className="flex border-b">
          <button
            onClick={() => setTab('documents')}
            className={cn("flex-1 py-2 text-sm font-medium border-b-2 transition-colors", tab === 'documents' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground')}
          >
            <FileText className="h-4 w-4 inline mr-1" /> Documenten
          </button>
          <button
            onClick={() => setTab('assistants')}
            className={cn("flex-1 py-2 text-sm font-medium border-b-2 transition-colors", tab === 'assistants' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground')}
          >
            <Link2 className="h-4 w-4 inline mr-1" /> Gekoppeld
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'documents' && (
            <div className="space-y-3">
              {isAdmin && (
                <div
                  className="rounded-lg border-2 border-dashed p-4"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                >
                  <div className="text-center">
                    <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="h-4 w-4 mr-2" /> Bestanden toevoegen
                    </Button>
                    <p className="mt-2 text-xs text-muted-foreground">of sleep bestanden hierheen · PDF, TXT, DOCX</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.txt,.docx"
                      multiple
                      className="hidden"
                      onChange={handleFileInput}
                    />
                  </div>

                  {uploadItems.length > 0 && (
                    <ul className="mt-4 space-y-2" aria-live="polite">
                      {uploadItems.map((item) => (
                        <li key={item.id} className="flex items-start justify-between gap-2 rounded border p-2 text-sm">
                          <span className="min-w-0 flex-1 truncate">{item.file.name}</span>
                          <div className="text-right">
                            <span className={cn('text-xs', item.status === 'error' && 'text-destructive', item.status === 'done' && 'text-primary')}>
                              {UPLOAD_STATUS_LABELS[item.status]}
                            </span>
                            {item.error && <p className="max-w-[16rem] text-xs text-destructive">{item.error}</p>}
                            {item.status === 'error' && item.retryable && (
                              <Button variant="ghost" size="sm" onClick={() => handleRetryUpload(item)}>
                                Opnieuw proberen
                              </Button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {docsLoading ? (
                <p className="text-center text-sm text-muted-foreground py-8">Laden...</p>
              ) : (documents ?? []).length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">Nog geen documenten toegevoegd</p>
              ) : (
                (documents ?? []).map((doc) => (
                  <div key={doc.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {doc.file_type.toUpperCase()} · {formatFileSize(doc.file_size)}
                      </p>
                      {doc.status === 'error' && (
                        <p className="mt-1 text-xs text-destructive">
                          {doc.error_message ?? GENERIC_DOCUMENT_ERROR}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <div className="flex items-center gap-2">
                        {doc.status === 'ready' && <Badge variant="default">Klaar</Badge>}
                        {doc.status === 'processing' && <Badge variant="secondary">Verwerken...</Badge>}
                        {doc.status === 'error' && <Badge variant="destructive">Fout</Badge>}
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Verwijder ${doc.name}`}
                            onClick={() => setPendingDelete({ type: 'document', document: doc })}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        )}
                      </div>
                      {isAdmin && doc.status === 'error' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRetryDocument(doc)}
                          disabled={retryingId === doc.id}
                        >
                          {retryingId === doc.id ? 'Bezig...' : 'Opnieuw verwerken'}
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'items' && (
            <div className="space-y-4">
              {isAdmin && (
                <form onSubmit={handleAddItem} className="space-y-3 p-3 border rounded-lg">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="item-title">Titel</Label>
                    <Input
                      id="item-title"
                      value={itemForm.title}
                      onChange={(e) => setItemForm((prev) => ({ ...prev, title: e.target.value }))}
                      placeholder="Titel van het kennisitem"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="item-content">Inhoud</Label>
                    <Textarea
                      id="item-content"
                      value={itemForm.content}
                      onChange={(e) => setItemForm((prev) => ({ ...prev, content: e.target.value }))}
                      placeholder="De tekst die naar de kennisindex gestuurd wordt..."
                      rows={5}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="item-source">Bron URL (optioneel)</Label>
                    <Input
                      id="item-source"
                      value={itemForm.sourceUrl}
                      onChange={(e) => setItemForm((prev) => ({ ...prev, sourceUrl: e.target.value }))}
                      placeholder="https://..."
                    />
                  </div>
                  <Button type="submit" size="sm" disabled={isSavingItem}>
                    <Plus className="h-4 w-4 mr-1" /> {isSavingItem ? 'Toevoegen...' : 'Toevoegen'}
                  </Button>
                </form>
              )}

              {itemsLoading ? (
                <p className="text-center text-sm text-muted-foreground py-8">Laden...</p>
              ) : (items ?? []).length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">Nog geen kennisitems toegevoegd</p>
              ) : (
                (items ?? []).map((item) => (
                  <div key={item.id} className="flex items-start justify-between p-3 rounded-lg border">
                    <div className="min-w-0 flex-1 mr-2">
                      <p className="text-sm font-medium truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{item.content}</p>
                      {item.source_url && (
                        <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate block mt-1">
                          {item.source_url}
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={item.embedding_status === 'done' ? 'default' : item.embedding_status === 'failed' ? 'destructive' : 'secondary'}>
                        {item.embedding_status === 'done' ? 'Klaar' : item.embedding_status === 'processing' ? 'Verwerken' : item.embedding_status === 'failed' ? 'Fout' : 'Wachtend'}
                      </Badge>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Verwijder ${item.title}`}
                          onClick={() => setPendingDelete({ type: 'item', item })}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'assistants' && (
            <div>
              {(linkedAssistants ?? []).length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">Nog geen assistenten gekoppeld</p>
              ) : (
                <div className="space-y-2">
                  {(linkedAssistants ?? []).map((a) => (
                    <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg border">
                      <span className="text-xl">{a.icon}</span>
                      <div>
                        <p className="text-sm font-medium">{a.name}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{a.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!pendingDelete} onOpenChange={(isOpen) => { if (!isOpen) setPendingDelete(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pendingDelete?.type === 'item' ? 'Kennisitem verwijderen' : 'Document verwijderen'}</DialogTitle>
          </DialogHeader>
          <p className="mt-4 text-sm">
            Weet u zeker dat u <strong>{pendingDeleteName}</strong> wilt verwijderen? Dit kan niet ongedaan worden gemaakt.
          </p>
          <DialogFooter>
            <Button variant="outline" autoFocus onClick={() => setPendingDelete(null)} disabled={isDeleting}>
              Annuleren
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={isDeleting}>
              {isDeleting ? 'Verwijderen...' : 'Verwijderen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function formatCount(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default KnowledgePage
