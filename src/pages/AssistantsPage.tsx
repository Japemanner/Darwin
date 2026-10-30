import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
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
import {
  useAssistants,
  useKnowledgeBases,
  useAssistantKBLinks,
  useCreateAssistant,
  useUpdateAssistant,
  useDeleteAssistant,
} from '@/hooks/queries'
import type { AIAssistant } from '@/types/database.types'
import { Bot, Plus, Pencil, MessagesSquare, Trash2, ClipboardList } from 'lucide-react'

const ASSISTANT_TYPES = [
  { value: 'chat', label: 'ðŸ’¬ Chat' },
  { value: 'risico_analyse', label: 'ðŸ“‹ Risico-analyse' },
]

// Max number of example questions per assistant (FR-013).
const MAX_EXAMPLE_QUESTIONS = 4

// One per line, trimmed, empty lines dropped.
function parseExampleQuestions(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

// Readable type labels shown on the assistant card badge (FR-001).
const ASSISTANT_TYPE_LABELS: Record<string, string> = {
  chat: 'Chat',
  risico_analyse: 'Risico-analyse',
}

function AssistantsPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const isAdmin = profile?.role === 'admin'
  const { data: assistants, isPending } = useAssistants(profile?.organization_id)
  // Members only see active assistants (FR-002); admins see all.
  const visibleAssistants = isAdmin
    ? (assistants ?? [])
    : (assistants ?? []).filter((a) => a.is_active)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingAssistant, setEditingAssistant] = useState<AIAssistant | null>(null)

  if (isPending) {
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
          <p className="text-muted-foreground">
            {isAdmin ? 'Beheer je AI assistenten en hun configuratie' : 'Start een gesprek met een assistent'}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => { setEditingAssistant(null); setModalOpen(true) }}>
            <Plus className="h-4 w-4 mr-2" /> Nieuwe assistent
          </Button>
        )}
      </div>

      {visibleAssistants.length === 0 ? (
        <EmptyState
          icon={<Bot className="h-12 w-12" />}
          title="Nog geen assistenten"
          description={isAdmin ? 'Maak je eerste AI assistent aan om te beginnen met chatten' : 'Er zijn nog geen actieve assistenten beschikbaar'}
          {...(isAdmin ? { action: { label: 'Maak assistent', onClick: () => { setEditingAssistant(null); setModalOpen(true) } } } : {})}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleAssistants.map((a) => (
            <Card key={a.id} className={cn("flex flex-col", !a.is_active && "opacity-60")}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{a.icon}</span>
                    <CardTitle className="text-lg">{a.name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-1">
                    {!a.is_active && <Badge variant="secondary">Inactief</Badge>}
                    <Badge variant="outline" className="text-xs">{ASSISTANT_TYPE_LABELS[a.type] ?? a.type}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {a.description ?? ''}
                </p>
              </CardContent>
              <CardFooter className="flex gap-2">
                {a.type === 'risico_analyse' ? (
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => navigate(`/analyse/new/${a.id}`)}>
                    <ClipboardList className="h-4 w-4 mr-2" /> Risico-analyse starten
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => navigate(`/chat/new/${a.id}`)}>
                    <MessagesSquare className="h-4 w-4 mr-2" /> Chat
                  </Button>
                )}
                {isAdmin && (
                  <Button variant="ghost" size="icon" onClick={() => { setEditingAssistant(a); setModalOpen(true) }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
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
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  assistant: AIAssistant | null
  organizationId: string
  userId: string
}) {
  const { toast } = useToast()
  const { data: availableKBs } = useKnowledgeBases(organizationId || undefined)
  const { data: linkedKBIds } = useAssistantKBLinks(assistant?.id)
  const createMutation = useCreateAssistant(organizationId)
  const updateMutation = useUpdateAssistant(organizationId)
  const deleteMutation = useDeleteAssistant(organizationId)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('ðŸ¤–')
  const [type, setType] = useState('chat')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [exampleQuestions, setExampleQuestions] = useState('')
  const [exampleQuestionsError, setExampleQuestionsError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedKBIds, setSelectedKBIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (assistant) {
      setName(assistant.name)
      setDescription(assistant.description ?? '')
      setIcon(assistant.icon ?? 'ðŸ¤–')
      setType(assistant.type ?? 'chat')
      setWebhookUrl(assistant.n8n_webhook_url ?? '')
      setIsActive(assistant.is_active);
      setExampleQuestions((assistant.example_questions ?? []).join('\n'))
      setSelectedKBIds(linkedKBIds ?? new Set())
    } else {
      setName('')
      setDescription('')
      setIcon('ðŸ¤–')
      setType('chat')
      setWebhookUrl('')
      setIsActive(true)
      setExampleQuestions('')
      setSelectedKBIds(new Set())
    }
    setExampleQuestionsError(null)
  }, [assistant, open, linkedKBIds])

  const handleExampleQuestionsChange = (value: string) => {
    setExampleQuestions(value)
    setExampleQuestionsError(
      parseExampleQuestions(value).length > MAX_EXAMPLE_QUESTIONS
        ? `Maximaal ${MAX_EXAMPLE_QUESTIONS} voorbeeldvragen.`
        : null,
    )
  }

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
    const parsedExampleQuestions = parseExampleQuestions(exampleQuestions)
    if (parsedExampleQuestions.length > MAX_EXAMPLE_QUESTIONS) {
      setExampleQuestionsError(`Maximaal ${MAX_EXAMPLE_QUESTIONS} voorbeeldvragen.`)
      return
    }
    setIsSaving(true)

    const payload = {
      organization_id: organizationId,
      name,
      description: description || null,
      system_prompt: assistant?.system_prompt ?? '',
      icon: icon || 'ðŸ¤–',
      type,
      n8n_webhook_url: webhookUrl.trim() || null,
      example_questions: parsedExampleQuestions,
      is_active: isActive,
      created_by: userId,
      kbIds: [...selectedKBIds],
    }

    try {
      if (assistant) {
        await updateMutation.mutateAsync({
          id: assistant.id,
          name: payload.name,
          description: payload.description,
          type: payload.type,
          icon: payload.icon,
          n8n_webhook_url: payload.n8n_webhook_url,
          example_questions: payload.example_questions,
          is_active: payload.is_active,
          kbIds: payload.kbIds,
        })
        toast({ title: 'Assistent bijgewerkt', description: `${name} is succesvol bijgewerkt` })
      } else {
        await createMutation.mutateAsync(payload)
        toast({ title: 'Assistent aangemaakt', description: `${name} is klaar voor gebruik` })
      }

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
      await deleteMutation.mutateAsync(assistant.id)
      toast({ title: 'Assistent verwijderd', description: `${assistant.name} is permanent verwijderd` })
      setShowDeleteConfirm(false)
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
          <div className="flex gap-4">
            <div className="flex flex-col gap-2 w-20">
              <Label htmlFor="icon">Icoon</Label>
              <Input id="icon" value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="ðŸ¤–" maxLength={4} className="text-center text-xl" />
            </div>
            <div className="flex flex-col gap-2 flex-1">
              <Label htmlFor="name">Naam</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Mijn assistent" required />
            </div>
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
            <Label htmlFor="example-questions">Voorbeeldvragen (Ã©Ã©n per regel, maximaal 4)</Label>
            <Textarea
              id="example-questions"
              value={exampleQuestions}
              onChange={(e) => handleExampleQuestionsChange(e.target.value)}
              placeholder={'Wat dekt mijn polis?\nHoe meld ik schade?'}
              rows={4}
              aria-invalid={!!exampleQuestionsError}
            />
            {exampleQuestionsError ? (
              <p className="text-xs text-destructive" role="alert">{exampleQuestionsError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Deze vragen staan als knoppen bij een nieuw gesprek.</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="webhook-url">N8N Webhook URL</Label>
            <Input id="webhook-url" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://n8n.example.com/webhook/mijn-flow" />
            <p className="text-xs text-muted-foreground">Optioneel. Als ingevuld, gebruikt deze assistent zijn eigen webhook URL i.p.v. de gedeelde RAG-configuratie.</p>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Kennisbronnen</Label>
            <p className="text-xs text-muted-foreground">Selecteer de kennisbronnen die deze assistent mag gebruiken</p>
            <div className="border rounded-lg max-h-40 overflow-y-auto">
              {(availableKBs ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground p-3">Geen kennisbronnen beschikbaar</p>
              ) : (
                (availableKBs ?? []).map((kb) => (
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
              <Button type="submit" disabled={isSaving || !!exampleQuestionsError}>{isSaving ? 'Opslaan...' : 'Opslaan'}</Button>
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

export default AssistantsPage
