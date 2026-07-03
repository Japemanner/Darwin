import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { callRagWebhook } from '@/lib/webhook'
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
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { MessageContent } from '@/components/chat/MessageContent'
import type { AIAssistant, Conversation, Message, KnowledgeBase, FeedbackInteraction } from '@/types/database.types'
import { Bot, Plus, Pencil, MessagesSquare, X, Send, ChevronDown, ChevronUp, Trash2, ThumbsUp, ThumbsDown } from 'lucide-react'

const ASSISTANT_TYPES = [
  { value: 'chat', label: '💬 Chat' },
]

function AssistantsPage() {
  const { profile } = useAuth()
  const [assistants, setAssistants] = useState<AIAssistant[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingAssistant, setEditingAssistant] = useState<AIAssistant | null>(null)
  const [chatAssistant, setChatAssistant] = useState<AIAssistant | null>(null)

  const loadAssistants = useCallback(async () => {
    if (!profile) return
    const { data, error } = await supabase
      .from('ai_assistants')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false })
    if (!error && data) setAssistants(data)
    setIsLoading(false)
  }, [profile])

  useEffect(() => {
    loadAssistants()
  }, [loadAssistants])

  if (isLoading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-8">
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72 mt-2" />
          </div>
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
          <h1 className="text-2xl font-bold">AI Assistenten</h1>
          <p className="text-muted-foreground">Beheer je AI assistenten en hun configuratie</p>
        </div>
        <Button onClick={() => { setEditingAssistant(null); setModalOpen(true) }}>
          <Plus className="h-4 w-4 mr-2" /> Nieuwe assistent
        </Button>
      </div>

      {assistants.length === 0 ? (
        <EmptyState
          icon={<Bot className="h-12 w-12" />}
          title="Nog geen assistenten"
          description="Maak je eerste AI assistent aan om te beginnen met chatten"
          action={{ label: 'Maak assistent', onClick: () => { setEditingAssistant(null); setModalOpen(true) } }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {assistants.map((a) => (
            <Card key={a.id} className={cn("flex flex-col", !a.is_active && "opacity-60")}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{a.icon}</span>
                    <CardTitle className="text-lg">{a.name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-1">
                    {!a.is_active && <Badge variant="secondary">Inactief</Badge>}
                    <Badge variant="outline" className="text-xs">{a.type}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {a.description || a.system_prompt}
                </p>
              </CardContent>
              <CardFooter className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setChatAssistant(a)}>
                  <MessagesSquare className="h-4 w-4 mr-2" /> Chat
                </Button>
                <Button variant="ghost" size="icon" onClick={() => { setEditingAssistant(a); setModalOpen(true) }}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <AssistantModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        assistant={editingAssistant}
        organizationId={profile?.organization_id ?? ''}
        userId={profile?.id ?? ''}
        onSaved={loadAssistants}
      />

      <ChatWindow
        assistant={chatAssistant}
        onClose={() => setChatAssistant(null)}
        userId={profile?.id ?? ''}
        organizationId={profile?.organization_id ?? ''}
      />
    </div>
  )
}

function AssistantModal({
  open,
  onOpenChange,
  assistant,
  organizationId,
  userId,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  assistant: AIAssistant | null
  organizationId: string
  userId: string
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState('chat')
  const [isActive, setIsActive] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [availableKBs, setAvailableKBs] = useState<KnowledgeBase[]>([])
  const [selectedKBIds, setSelectedKBIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (open && organizationId) {
      const loadKBs = async () => {
        const { data } = await supabase
          .from('knowledge_bases')
          .select('*')
          .eq('organization_id', organizationId)
          .order('name', { ascending: true })
        if (data) setAvailableKBs(data)
      }
      loadKBs()
    }
  }, [open, organizationId])

  useEffect(() => {
    if (assistant) {
      setName(assistant.name)
      setDescription(assistant.description ?? '')
      setType(assistant.type ?? 'chat')
      setIsActive(assistant.is_active);

      void (supabase as any).from('assistant_knowledge_bases') // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase type inference limitation
        .select('knowledge_base_id')
        .eq('assistant_id', assistant.id)
        .then(({ data }: { data: Array<{ knowledge_base_id: string }> | null }) => {
          if (data) setSelectedKBIds(new Set(data.map((d) => d.knowledge_base_id)))
          else setSelectedKBIds(new Set())
        })
    } else {
      setName('')
      setDescription('')
      setType('chat')
      setIsActive(true)
      setSelectedKBIds(new Set())
    }
  }, [assistant, open])

  const toggleKB = (id: string) => {
    setSelectedKBIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    const payload = {
      organization_id: organizationId,
      name,
      description: description || null,
      system_prompt: assistant?.system_prompt ?? '',
      icon: assistant?.icon ?? '🤖',
      type,
      n8n_webhook_url: null,
      is_active: isActive,
      created_by: userId,
    }

    try {
      let assistantId: string

      if (assistant) {
        const { error } = await (supabase as any).from('ai_assistants').update(payload).eq('id', assistant.id) // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase type inference limitation
        if (error) throw error
        assistantId = assistant.id
        toast({ title: 'Assistent bijgewerkt', description: `${name} is succesvol bijgewerkt` })
      } else {
        const { data: created, error } = await (supabase as any).from('ai_assistants').insert(payload).select().single() // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase type inference limitation
        if (error) throw error
        assistantId = created.id
        toast({ title: 'Assistent aangemaakt', description: `${name} is klaar voor gebruik` })
      }

      const { data: existingLinks } = await (supabase as any) // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase type inference limitation
        .from('assistant_knowledge_bases')
        .select('knowledge_base_id')
        .eq('assistant_id', assistantId)

      const existingIds = new Set(((existingLinks ?? []) as Array<{ knowledge_base_id: string }>).map((l) => l.knowledge_base_id))
      const toAdd = [...selectedKBIds].filter((id) => !existingIds.has(id))
      const toRemove = [...existingIds].filter((id) => !selectedKBIds.has(id))

      if (toRemove.length > 0) {
        await (supabase as any).from('assistant_knowledge_bases') // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase type inference limitation
          .delete()
          .eq('assistant_id', assistantId)
          .in('knowledge_base_id', toRemove)
      }

      if (toAdd.length > 0) {
        await (supabase as any).from('assistant_knowledge_bases') // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase type inference limitation
          .insert(toAdd.map((kbId) => ({ assistant_id: assistantId, knowledge_base_id: kbId })))
      }

      onSaved()
      onOpenChange(false)
    } catch (err) {
      toast({ title: 'Fout', description: err instanceof Error ? err.message : 'Onbekende fout', variant: 'destructive' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!assistant) return
    setIsDeleting(true)
    try {
      const { error: convError } = await (supabase as any).from('conversations').delete().eq('assistant_id', assistant.id) // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase type inference limitation; RLS enforces user_id = auth.uid()
      if (convError) throw convError

      const { error: kbError } = await (supabase as any).from('assistant_knowledge_bases').delete().eq('assistant_id', assistant.id) // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase type inference limitation; RLS enforces org scoping
      if (kbError) throw kbError

      const { error } = await (supabase as any).from('ai_assistants').delete().eq('id', assistant.id) // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase type inference limitation
      if (error) throw error

      toast({ title: 'Assistent verwijderd', description: `${assistant.name} is permanent verwijderd` })
      setShowDeleteConfirm(false)
      onSaved()
      onOpenChange(false)
    } catch (err) {
      toast({ title: 'Fout bij verwijderen', description: err instanceof Error ? err.message : 'Onbekende fout', variant: 'destructive' })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <form onSubmit={handleSave}>
        <DialogHeader>
          <DialogTitle>{assistant ? 'Assistent bewerken' : 'Nieuwe assistent'}</DialogTitle>
        </DialogHeader>
        <DialogContent className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Naam</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Mijn assistent" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="type">Type</Label>
            <Select value={type} onValueChange={setType} options={ASSISTANT_TYPES} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="desc">Beschrijving</Label>
            <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Korte omschrijving" rows={2} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Kennisbronnen</Label>
            <p className="text-xs text-muted-foreground">Selecteer de kennisbronnen die deze assistent mag gebruiken</p>
            <div className="border rounded-lg max-h-40 overflow-y-auto">
              {availableKBs.length === 0 ? (
                <p className="text-sm text-muted-foreground p-3">Geen kennisbronnen beschikbaar</p>
              ) : (
                availableKBs.map((kb) => (
                  <label key={kb.id} className="flex items-center gap-2 p-2 hover:bg-accent cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedKBIds.has(kb.id)}
                      onChange={() => toggleKB(kb.id)}
                      className="rounded border-input"
                    />
                    <span className="text-sm">{kb.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded border-input" />
            <span className="text-sm">Actief</span>
          </label>
        </DialogContent>
        <DialogFooter>
          <div className="flex gap-2 w-full justify-between">
            <div>
              {assistant && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Verwijderen
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
              <Button type="submit" disabled={isSaving}>{isSaving ? 'Opslaan...' : 'Opslaan'}</Button>
            </div>
          </div>
        </DialogFooter>
      </form>

      {showDeleteConfirm && (
        <Dialog open={showDeleteConfirm} onOpenChange={(open) => { if (!open) setShowDeleteConfirm(false) }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assistent verwijderen</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Weet je zeker dat je <strong>{assistant?.name}</strong> wilt verwijderen? Dit verwijdert ook alle gekoppelde conversaties en kennisbronkoppelingen.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>Annuleren</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? <Spinner className="h-4 w-4 mr-2" /> : null}
                {isDeleting ? 'Verwijderen...' : 'Verwijderen'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  )
}

interface Source {
  knowledge_item_id?: string
  title?: string
  excerpt?: string
  score?: number
}

function ChatWindow({
  assistant,
  onClose,
  userId,
  organizationId,
}: {
  assistant: AIAssistant | null
  onClose: () => void
  userId: string
  organizationId: string
}) {
  const { toast } = useToast()
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set())
  const [existingFeedback, setExistingFeedback] = useState<FeedbackInteraction | null>(null)
  const [isFeedbackLoaded, setIsFeedbackLoaded] = useState(false)
  const [feedbackText, setFeedbackText] = useState('')
  const [isFeedbackSubmitting, setIsFeedbackSubmitting] = useState(false)
  const [showFeedbackInput, setShowFeedbackInput] = useState(false)
  const [thumbsUpSelected, setThumbsUpSelected] = useState(false)
  const [thumbsDownSelected, setThumbsDownSelected] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!assistant) return
    setMessages([])
    setConversation(null)
    setInput('')
    setExistingFeedback(null)
    setIsFeedbackLoaded(false)
    setFeedbackText('')
    setIsFeedbackSubmitting(false)
    setShowFeedbackInput(false)
    setThumbsUpSelected(false)
    setThumbsDownSelected(false)

    async function initChat() {
      const { data: created } = await (supabase as any) // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase type inference limitation
          .from('conversations')
          .insert({
            user_id: userId,
            assistant_id: assistant!.id,
            title: `Chat met ${assistant!.name}`,
          })
          .select()
          .single()
        if (created) setConversation(created)
    }

    initChat()
  }, [assistant, userId])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!conversation || isFeedbackLoaded) return
    const loadFeedback = async () => {
      const { data } = await (supabase as any).from('feedback_interactions') // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase type inference limitation
        .select('*')
        .eq('conversation_id', conversation.id)
        .eq('user_id', userId)
        .maybeSingle()
      setExistingFeedback(data)
      setIsFeedbackLoaded(true)
    }
    loadFeedback()
  }, [conversation, userId, isFeedbackLoaded])

  const toggleSources = (messageId: string) => {
    setExpandedSources((prev) => {
      const next = new Set(prev)
      if (next.has(messageId)) next.delete(messageId)
      else next.add(messageId)
      return next
    })
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !conversation || !assistant || isSending) return

    const userMessage: Message = {
      id: crypto.randomUUID(),
      conversation_id: conversation.id,
      role: 'user',
      content: input.trim(),
      created_at: new Date().toISOString(),
      sources: null,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsSending(true)

    const { error: msgError } = await (supabase as any).from('messages').insert({ // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase type inference limitation
      conversation_id: conversation.id,
      role: 'user',
      content: userMessage.content,
    })
    if (msgError) {
      toast({ title: 'Fout bij opslaan bericht', variant: 'destructive' })
    }

    try {
      const result = await callRagWebhook(assistant, conversation, userMessage.content, organizationId)

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        conversation_id: conversation.id,
        role: 'assistant',
        content: result.answer,
        created_at: new Date().toISOString(),
        sources: result.sources as Record<string, unknown> | null,
      }

      setMessages((prev) => [...prev, assistantMessage])

      await (supabase as any).from('messages').insert({ // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase type inference limitation
        conversation_id: conversation.id,
        role: 'assistant',
        content: result.answer,
        sources: result.sources,
      })
    } catch (err) {
      const description = err instanceof Error ? err.message : 'Kon geen antwoord krijgen'
      const title = description.includes('verbinding maken') || description.includes('CORS')
        ? 'Verbindingsfout'
        : description.includes('geweigerd') || description.includes('Authenticatiefout')
          ? 'Authenticatiefout'
          : description.includes('niet gevonden')
            ? 'Webhook niet gevonden'
            : 'Fout bij versturen'
      toast({
        title,
        description,
        variant: 'destructive',
      })
    } finally {
      setIsSending(false)
    }
  }

  const handleThumbsUp = async () => {
    if (!conversation || !assistant || existingFeedback) return
    setThumbsUpSelected(true)
    try {
      const { error } = await (supabase as any).from('feedback_interactions').insert({ // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase type inference limitation
        conversation_id: conversation.id,
        assistant_id: assistant.id,
        user_id: userId,
        organization_id: organizationId,
        thumbs_up: true,
        feedback: null,
      })
      if (error) throw error
      setExistingFeedback({ id: '', conversation_id: conversation.id, assistant_id: assistant.id, user_id: userId, organization_id: organizationId, thumbs_up: true, feedback: null, created_at: new Date().toISOString() } as FeedbackInteraction)
    } catch (err: unknown) {
      setThumbsUpSelected(false)
      toast({ title: 'Fout', description: err instanceof Error ? err.message : 'Kon feedback niet opslaan', variant: 'destructive' })
    }
  }

  const handleThumbsDownClick = () => {
    if (existingFeedback) return
    setThumbsDownSelected(true)
    setShowFeedbackInput(true)
  }

  const handleThumbsDownCancel = () => {
    setThumbsDownSelected(false)
    setShowFeedbackInput(false)
    setFeedbackText('')
  }

  const handleThumbsDownSubmit = async () => {
    if (!conversation || !assistant || !feedbackText.trim()) return
    setIsFeedbackSubmitting(true)
    try {
      const { error } = await (supabase as any).from('feedback_interactions').insert({ // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase type inference limitation
        conversation_id: conversation.id,
        assistant_id: assistant.id,
        user_id: userId,
        organization_id: organizationId,
        thumbs_up: false,
        feedback: feedbackText.trim(),
      })
      if (error) throw error
      setExistingFeedback({ id: '', conversation_id: conversation.id, assistant_id: assistant.id, user_id: userId, organization_id: organizationId, thumbs_up: false, feedback: feedbackText.trim(), created_at: new Date().toISOString() } as FeedbackInteraction)
      setShowFeedbackInput(false)
      setFeedbackText('')
    } catch (err: unknown) {
      toast({ title: 'Fout', description: err instanceof Error ? err.message : 'Kon feedback niet opslaan', variant: 'destructive' })
    } finally {
      setIsFeedbackSubmitting(false)
    }
  }

  const hasAssistantMessages = messages.some((msg) => msg.role === 'assistant')
  const feedbackSubmitted = !!existingFeedback

  if (!assistant) return null

  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-[480px] bg-background border-l shadow-2xl z-40 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <span className="text-xl">{assistant.icon}</span>
          <div>
            <h2 className="font-semibold">{assistant.name}</h2>
            <p className="text-xs text-muted-foreground">{assistant.description}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-center text-muted-foreground text-sm mt-8">
            Stuur een bericht om het gesprek te starten met {assistant.name}
          </p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={cn("flex", msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className="flex flex-col gap-1 max-w-[80%]">
              <div className={cn(
                "rounded-lg px-4 py-2 text-sm",
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              )}>
                <MessageContent content={msg.content} />
              </div>
              {msg.role === 'assistant' && msg.sources && Array.isArray(msg.sources) && (msg.sources as Source[]).length > 0 && (
                <div className="text-xs">
                  <button
                    onClick={() => toggleSources(msg.id)}
                    className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {expandedSources.has(msg.id) ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    Bronnen ({(msg.sources as Source[]).length})
                  </button>
                  {expandedSources.has(msg.id) && (
                    <div className="mt-2 space-y-2">
                      {(msg.sources as Source[]).map((source, idx) => (
                        <div key={idx} className="bg-accent/50 rounded p-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-foreground">{source.title ?? 'Zonder titel'}</span>
                            {source.score !== undefined && (
                              <Badge variant="secondary" className="text-xs">{Math.round(source.score * 100)}%</Badge>
                            )}
                          </div>
                          {source.excerpt && (
                            <p className="text-muted-foreground line-clamp-3">{source.excerpt}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {isSending && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-4 py-2 text-sm flex items-center gap-2">
              <Spinner className="h-3 w-3" /> Typen...
            </div>
          </div>
        )}
      </div>

      {hasAssistantMessages && (
        <div className="border-t px-4 py-3 flex flex-col gap-2">
          {!feedbackSubmitted ? (
            <>
              {!showFeedbackInput ? (
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleThumbsUp}
                    disabled={thumbsDownSelected}
                    className={cn(
                      "p-2 rounded-full transition-colors",
                      thumbsUpSelected
                        ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                        : "hover:bg-accent text-muted-foreground hover:text-foreground"
                    )}
                    title="Goed antwoord"
                  >
                    <ThumbsUp className={cn("h-5 w-5", thumbsUpSelected && "fill-current")} />
                  </button>
                  <button
                    type="button"
                    onClick={handleThumbsDownClick}
                    disabled={thumbsUpSelected}
                    className={cn(
                      "p-2 rounded-full transition-colors",
                      thumbsDownSelected
                        ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                        : "hover:bg-accent text-muted-foreground hover:text-foreground"
                    )}
                    title="Niet goed — geef feedback"
                  >
                    <ThumbsDown className={cn("h-5 w-5", thumbsDownSelected && "fill-current")} />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleThumbsDownCancel}
                      className="text-muted-foreground hover:text-foreground"
                      title="Annuleren"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <span className="text-sm text-muted-foreground">Wat ging er mis?</span>
                  </div>
                  <Textarea
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder="Beschrijf wat er niet goed was aan dit antwoord..."
                    rows={2}
                    className="resize-none"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleThumbsDownCancel}
                      disabled={isFeedbackSubmitting}
                    >
                      Annuleren
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleThumbsDownSubmit}
                      disabled={isFeedbackSubmitting || !feedbackText.trim()}
                    >
                      {isFeedbackSubmitting ? 'Versturen...' : 'Feedback versturen'}
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground py-1">
              {existingFeedback.thumbs_up ? (
                <><ThumbsUp className="h-4 w-4 fill-current text-green-500" /> <span>Bedankt voor je feedback!</span></>
              ) : (
                <><ThumbsDown className="h-4 w-4 fill-current text-red-500" /> <span>Bedankt, we gaan hiermee aan de slag.</span></>
              )}
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSend} className="p-4 border-t flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Typ je bericht..."
          disabled={isSending}
        />
        <Button type="submit" size="icon" disabled={isSending || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  )
}

export default AssistantsPage
