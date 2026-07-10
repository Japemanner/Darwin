import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { uploadDocument, deleteDocument } from '@/lib/storage'
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
  useKnowledgeItems,
  useLinkedAssistants,
  useCreateKnowledgeBase,
  useUpdateKnowledgeBase,
  useAddKnowledgeItem,
  useDeleteKnowledgeItem,
} from '@/hooks/queries'
import { useQueryClient } from '@tanstack/react-query'
import type { KnowledgeBase, KnowledgeBaseDocument, KnowledgeItem } from '@/types/database.types'
import { BookOpen, Plus, FileText, Trash2, Upload, Link2, X, FilePlus } from 'lucide-react'

function KnowledgePage() {
  const { profile } = useAuth()
  const { data: knowledgeBases, isPending } = useKnowledgeBases(profile?.organization_id)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingKB, setEditingKB] = useState<KnowledgeBase | null>(null)
  const [selectedKB, setSelectedKB] = useState<KnowledgeBase | null>(null)

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
          <p className="text-muted-foreground">Beheer documenten en koppel ze aan assistenten</p>
        </div>
        <Button onClick={() => { setEditingKB(null); setModalOpen(true) }}>
          <Plus className="h-4 w-4 mr-2" /> Nieuwe kennisbron
        </Button>
      </div>

      {(knowledgeBases ?? []).length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-12 w-12" />}
          title="Nog geen kennisbronnen"
          description="Upload documenten zodat je assistenten er kennis uit kunnen putten"
          action={{ label: 'Maak kennisbron', onClick: () => { setEditingKB(null); setModalOpen(true) } }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(knowledgeBases ?? []).map((kb) => (
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
              </CardContent>
              <CardFooter>
                <Button variant="ghost" size="sm" className="ml-auto" onClick={(e) => { e.stopPropagation(); setEditingKB(kb); setModalOpen(true) }}>
                  Bewerken
                </Button>
              </CardFooter>
            </Card>
          ))}
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
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [vectorCollectionId, setVectorCollectionId] = useState('')
  const [isSaving, setIsSaving] = useState(false)

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
            <Input id="kb-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Mijn kennisbron" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="kb-desc">Beschrijving</Label>
            <Textarea id="kb-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optionele omschrijving" rows={3} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="kb-vector">Vector Collection ID</Label>
            <Input id="kb-vector" value={vectorCollectionId} onChange={(e) => setVectorCollectionId(e.target.value)} placeholder="my-collection-name" />
            <p className="text-xs text-muted-foreground">Verwijzing naar de collectie in de vector database (Pinecone namespace, Qdrant collection, etc.)</p>
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
}: {
  kb: KnowledgeBase | null
  onClose: () => void
  userId: string
  organizationId: string
}) {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [tab, setTab] = useState<'documents' | 'items' | 'assistants'>('documents')
  const [isUploading, setIsUploading] = useState(false)
  const [itemForm, setItemForm] = useState({ title: '', content: '', sourceUrl: '' })
  const [isSavingItem, setIsSavingItem] = useState(false)

  const { data: documents, isPending: docsLoading } = useKnowledgeBaseDocuments(kb?.id)
  const { data: items, isPending: itemsLoading } = useKnowledgeItems(kb?.id)
  const { data: linkedAssistants } = useLinkedAssistants(kb?.id)
  const addItemMutation = useAddKnowledgeItem(kb?.id ?? '')
  const deleteItemMutation = useDeleteKnowledgeItem(kb?.id ?? '')

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !kb) return

    const ALLOWED_EXTENSIONS = ['pdf', 'txt', 'docx']
    const fileExt = file.name.split('.').pop()?.toLowerCase()
    if (!fileExt || !ALLOWED_EXTENSIONS.includes(fileExt)) {
      toast({ title: 'Ongeldig bestandstype', description: `Toegestane typen: ${ALLOWED_EXTENSIONS.join(', ').toUpperCase()}`, variant: 'destructive' })
      e.target.value = ''
      return
    }

    setIsUploading(true)
    try {
      await uploadDocument(file, kb.id, kb.name, userId, organizationId)
      toast({ title: 'Document geüpload', description: file.name })
      qc.invalidateQueries({ queryKey: ['kb-documents', kb.id] })
    } catch (err) {
      toast({ title: 'Upload mislukt', description: err instanceof Error ? err.message : 'Onbekende fout', variant: 'destructive' })
    } finally {
      setIsUploading(false)
      e.target.value = ''
    }
  }

  const handleDeleteDoc = async (doc: KnowledgeBaseDocument) => {
    try {
      await deleteDocument(doc.id, doc.file_path, organizationId, kb!.name, doc.name)
      toast({ title: 'Document verwijderd' })
      qc.invalidateQueries({ queryKey: ['kb-documents', kb?.id] })
    } catch {
      toast({ title: 'Fout bij verwijderen', variant: 'destructive' })
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

  const handleDeleteItem = async (item: KnowledgeItem) => {
    try {
      await deleteItemMutation.mutateAsync(item.id)
      toast({ title: 'Kennisitem verwijderd' })
    } catch {
      toast({ title: 'Fout bij verwijderen', variant: 'destructive' })
    }
  }

  if (!kb) return null

  return (
    <div className="fixed inset-0 z-40">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-background border-l shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold text-lg">{kb.name}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>

        <div className="flex border-b">
          <button
            onClick={() => setTab('documents')}
            className={cn("flex-1 py-2 text-sm font-medium border-b-2 transition-colors", tab === 'documents' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground')}
          >
            <FileText className="h-4 w-4 inline mr-1" /> Documenten
          </button>
          <button
            onClick={() => setTab('items')}
            className={cn("flex-1 py-2 text-sm font-medium border-b-2 transition-colors", tab === 'items' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground')}
          >
            <FilePlus className="h-4 w-4 inline mr-1" /> Kennisitems
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
              <label className="flex items-center justify-center border-2 border-dashed rounded-lg p-6 cursor-pointer hover:bg-accent/50 transition-colors">
                <div className="text-center">
                  <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium">{isUploading ? 'Uploaden...' : 'Klik om te uploaden'}</p>
                  <p className="text-xs text-muted-foreground">PDF, TXT, DOCX</p>
                </div>
                <input type="file" accept=".pdf,.txt,.docx" className="hidden" onChange={handleUpload} disabled={isUploading} />
              </label>

              {docsLoading ? (
                <p className="text-center text-sm text-muted-foreground py-8">Laden...</p>
              ) : (documents ?? []).length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">Nog geen documenten geüpload</p>
              ) : (
                (documents ?? []).map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {doc.file_type.toUpperCase()} · {formatFileSize(doc.file_size)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {doc.status === 'ready' && (
                        <Badge variant="default">Klaar</Badge>
                      )}
                      {doc.status === 'processing' && (
                        <Badge variant="secondary">Verwerken...</Badge>
                      )}
                      {doc.status === 'error' && (
                        <Badge variant="destructive">Error</Badge>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteDoc(doc)}>
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'items' && (
            <div className="space-y-4">
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
                    placeholder="De tekst die naar de vector database gestuurd wordt..."
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
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteItem(item)}>
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
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
    </div>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default KnowledgePage