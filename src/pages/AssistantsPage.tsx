import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
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
import type { AIAssistant, Conversation, Message } from '@/types/database.types'
import { Bot, Plus, Pencil, MessagesSquare, X, Send } from 'lucide-react'

const EMOJI_OPTIONS = [
  { value: '🤖', label: '🤖 Robot' },
  { value: '🧠', label: '🧠 Brein' },
  { value: '💬', label: '💬 Chat' },
  { value: '📚', label: '📚 Boek' },
  { value: '⚡', label: '⚡ Bliksem' },
  { value: '🔍', label: '🔍 Zoeken' },
  { value: '📊', label: '📊 Data' },
  { value: '🛡️', label: '🛡️ Schild' },
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
                  {!a.is_active && <Badge variant="secondary">Inactief</Badge>}
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
  const [systemPrompt, setSystemPrompt] = useState('')
  const [icon, setIcon] = useState('🤖')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (assistant) {
      setName(assistant.name)
      setDescription(assistant.description ?? '')
      setSystemPrompt(assistant.system_prompt)
      setIcon(assistant.icon)
      setWebhookUrl(assistant.n8n_webhook_url)
      setIsActive(assistant.is_active)
    } else {
      setName('')
      setDescription('')
      setSystemPrompt('')
      setIcon('🤖')
      setWebhookUrl('')
      setIsActive(true)
    }
  }, [assistant, open])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    const payload = {
      organization_id: organizationId,
      name,
      description: description || null,
      system_prompt: systemPrompt,
      icon,
      n8n_webhook_url: webhookUrl,
      is_active: isActive,
      created_by: userId,
    }

    try {
      if (assistant) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any).from('ai_assistants').update(payload).eq('id', assistant.id)
        if (error) throw error
        toast({ title: 'Assistent bijgewerkt', description: `${name} is succesvol bijgewerkt` })
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any).from('ai_assistants').insert(payload)
        if (error) throw error
        toast({ title: 'Assistent aangemaakt', description: `${name} is klaar voor gebruik` })
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
        <DialogHeader>
          <DialogTitle>{assistant ? 'Assistent bewerken' : 'Nieuwe assistent'}</DialogTitle>
        </DialogHeader>
        <DialogContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Naam</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Mijn assistent" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="icon">Icoon</Label>
            <Select value={icon} onValueChange={setIcon} options={EMOJI_OPTIONS} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="desc">Beschrijving</Label>
            <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Korte omschrijving" rows={2} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="prompt">System prompt</Label>
            <Textarea id="prompt" value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} placeholder="Je bent een behulpzame assistent..." rows={4} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="webhook">N8N Webhook URL</Label>
            <Input id="webhook" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://n8n.example.com/webhook/..." required />
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded border-input" />
            <span className="text-sm">Actief</span>
          </label>
        </DialogContent>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
          <Button type="submit" disabled={isSaving}>{isSaving ? 'Opslaan...' : 'Opslaan'}</Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
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
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!assistant) return
    setMessages([])
    setConversation(null)
    setInput('')

    async function initChat() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const existing = (await supabase
          .from('conversations')
          .select('*')
          .eq('user_id', userId)
          .eq('assistant_id', assistant!.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()).data as Conversation | null

      if (existing) {
        setConversation(existing)
        const { data: msgs } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', existing.id)
          .order('created_at', { ascending: true })
        if (msgs) setMessages(msgs)
      } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: created } = await (supabase as any)
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
    }

    initChat()
  }, [assistant, userId])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !conversation || !assistant || isSending) return

    const userMessage: Message = {
      id: crypto.randomUUID(),
      conversation_id: conversation.id,
      role: 'user',
      content: input.trim(),
      created_at: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsSending(true)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: msgError } = await (supabase as any).from('messages').insert({
      conversation_id: conversation.id,
      role: 'user',
      content: userMessage.content,
    })
    if (msgError) {
      toast({ title: 'Fout bij opslaan bericht', variant: 'destructive' })
    }

    try {
      const res = await fetch(assistant.n8n_webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          conversation_id: conversation.id,
          assistant_id: assistant.id,
          organization_id: organizationId,
          user_id: userId,
        }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const responseText: string = data?.response ?? 'Geen antwoord ontvangen'

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        conversation_id: conversation.id,
        role: 'assistant',
        content: responseText,
        created_at: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, assistantMessage])

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('messages').insert({
        conversation_id: conversation.id,
        role: 'assistant',
        content: responseText,
      })
    } catch (err) {
      toast({
        title: 'Fout bij versturen',
        description: err instanceof Error ? err.message : 'Kon geen antwoord krijgen',
        variant: 'destructive',
      })
    } finally {
      setIsSending(false)
    }
  }

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
            <div className={cn(
              "max-w-[80%] rounded-lg px-4 py-2 text-sm",
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted'
            )}>
              {msg.content}
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
