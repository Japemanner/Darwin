import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
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
import type { KnowledgeBase, KnowledgeBaseDocument, KnowledgeItem, AIAssistant } from '@/types/database.types'
import { BookOpen, Plus, FileText, Trash2, Upload, Link2, X, FilePlus } from 'lucide-react'

function KnowledgePage() {
  const { profile } = useAuth()
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingKB, setEditingKB] = useState<KnowledgeBase | null>(null)
  const [selectedKB, setSelectedKB] = useState<KnowledgeBase | null>(null)

  const loadKnowledgeBases = useCallback(async () => {
    if (!profile) return
    const { data } = await supabase
      .from('knowledge_bases')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false })
    if (data) setKnowledgeBases(data)
    setIsLoading(false)
  }, [profile])

  useEffect(() => { loadKnowledgeBases() }, [loadKnowledgeBases])

  if (isLoading) {
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

      {knowledgeBases.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-12 w-12" />}
          title="Nog geen kennisbronnen"
          description="Upload documenten zodat je assistenten er kennis uit kunnen putten"
          action={{ label: 'Maak kennisbron', onClick: () => { setEditingKB(null); setModalOpen(true) } }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {knowledgeBases.map((kb) => (
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
        onSaved={loadKnowledgeBases}
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
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  kb: KnowledgeBase | null
  organizationId: string
  userId: string
  onSaved: () => void
}) {
  const { toast } = useToast()
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
        const { error } = await (supabase as any).from('knowledge_bases').update(payload).eq('id', kb.id) // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase type inference limitation
        if (error) throw error
        toast({ title: 'Kennisbron bijgewerkt' })
      } else {
        const { error } = await (supabase as any).from('knowledge_bases').insert(payload) // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase type inference limitation
        if (error) throw error
        toast({ title: 'Kennisbron aangemaakt' })
      }
      onSaved()
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
  const [tab, setTab] = useState<'documents' | 'items' | 'assistants'>('documents')
  const [documents, setDocuments] = useState<KnowledgeBaseDocument[]>([])
  const [items, setItems] = useState<KnowledgeItem[]>([])
  const [linkedAssistants, setLinkedAssistants] = useState<AIAssistant[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [itemForm, setItemForm] = useState({ title: '', content: '', sourceUrl: '' })
  const [isSavingItem, setIsSavingItem] = useState(false)

  useEffect(() => {
    if (!kb) return
    const kbId = kb.id
    async function load() {
      const { data: docs } = await supabase
        .from('knowledge_base_documents')
        .select('*')
        .eq('knowledge_base_id', kbId)
        .order('created_at', { ascending: false })
      if (docs) setDocuments(docs)

      const { data: kItems } = await supabase
        .from('knowledge_items')
        .select('*')
        .eq('knowledge_base_id', kbId)
        .order('created_at', { ascending: false })
      if (kItems) setItems(kItems)

      const { data: links } = await (supabase as any) // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase type inference limitation
        .from('assistant_knowledge_bases')
        .select('assistant_id')
        .eq('knowledge_base_id', kbId)
      if (links && links.length > 0 && kb) {
        const { data: assistants } = await supabase
          .from('ai_assistants')
          .select('*')
          .in('id', (links as { assistant_id: string }[]).map((l) => l.assistant_id))
        if (assistants) setLinkedAssistants(assistants)
      } else {
        setLinkedAssistants([])
      }
    }
    load()
  }, [kb])

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
      const { data: docs } = await supabase
        .from('knowledge_base_documents')
        .select('*')
        .eq('knowledge_base_id', kb.id)
        .order('created_at', { ascending: false })
      if (docs) setDocuments(docs)
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
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id))
    } catch (err) {
      toast({ title: 'Fout bij verwijderen', variant: 'destructive' })
    }
  }

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!kb || !itemForm.title.trim() || !itemForm.content.trim() || isSavingItem) return
    setIsSavingItem(true)
    try {
      const { error } = await (supabase as any).from('knowledge_items').insert({ // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase type inference limitation
        knowledge_base_id: kb.id,
        title: itemForm.title.trim(),
        content: itemForm.content.trim(),
        source_url: itemForm.sourceUrl.trim() || null,
        embedding_status: 'pending',
        created_by: userId,
      })
      if (error) throw error
      toast({ title: 'Kennisitem toegevoegd', description: itemForm.title.trim() })
      setItemForm({ title: '', content: '', sourceUrl: '' })
      const { data: kItems } = await supabase
        .from('knowledge_items')
        .select('*')
        .eq('knowledge_base_id', kb.id)
        .order('created_at', { ascending: false })
      if (kItems) setItems(kItems)
    } catch (err) {
      toast({ title: 'Fout bij toevoegen', description: err instanceof Error ? err.message : 'Onbekende fout', variant: 'destructive' })
    } finally {
      setIsSavingItem(false)
    }
  }

  const handleDeleteItem = async (item: KnowledgeItem) => {
    try {
      const { error } = await supabase
        .from('knowledge_items')
        .delete()
        .eq('id', item.id)
      if (error) throw error
      toast({ title: 'Kennisitem verwijderd' })
      setItems((prev) => prev.filter((i) => i.id !== item.id))
    } catch (err) {
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

              {documents.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">Nog geen documenten geüpload</p>
              ) : (
                documents.map((doc) => (
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
                      <Badge variant={doc.status === 'ready' ? 'default' : 'secondary'}>
                        {doc.status === 'ready' ? 'Klaar' : doc.status === 'processing' ? 'Verwerken' : 'Fout'}
                      </Badge>
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

              {items.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">Nog geen kennisitems toegevoegd</p>
              ) : (
                items.map((item) => (
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
              {linkedAssistants.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">Nog geen assistenten gekoppeld</p>
              ) : (
                <div className="space-y-2">
                  {linkedAssistants.map((a) => (
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
