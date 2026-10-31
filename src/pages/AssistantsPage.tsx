import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useIsPlatformAdmin } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  useAssistants,
  useKnowledgeBases,
  useAssistantKBLinks,
  useUpdateAssistantKnowledgeBases,
} from '@/hooks/queries'
import type { AIAssistant } from '@/types/database.types'
import { saveCatalogAssistant } from '@/lib/platform-admin-client'
import { assistantTypeLabel } from '@/lib/labels'
import { supabase } from '@/lib/supabase'
import { Bot, Plus, Pencil, MessagesSquare, ClipboardList } from 'lucide-react'

const ASSISTANT_TYPES = [
  { value: 'chat', label: '💬 Chat' },
  { value: 'risico_analyse', label: '📋 Risico-analyse' },
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

function AssistantsPage() {
  const { profile } = useAuth()
  const { data: isPlatformAdmin = false } = useIsPlatformAdmin()
  const navigate = useNavigate()
  const isAdmin = profile?.role === 'admin'
  // Office admins only manage knowledge links; the platform admin edits the
  // catalogue definition (feature 019, US3/US5).
  const canManage = isAdmin || isPlatformAdmin
  const { data: assistants, isPending } = useAssistants(profile?.organization_id)
  // Only the platform admin sees switched-off assistants (with "Inactief").
  const visibleAssistants = isPlatformAdmin
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
          <h1 className="text-2xl font-bold">AI-assistenten</h1>
          <p className="text-muted-foreground">
            {isPlatformAdmin
              ? 'Beheer de assistentcatalogus voor alle organisaties'
              : 'Start een gesprek met een assistent'}
          </p>
        </div>
        {isPlatformAdmin && (
          <Button onClick={() => { setEditingAssistant(null); setModalOpen(true) }}>
            <Plus className="h-4 w-4 mr-2" /> Nieuwe assistent
          </Button>
        )}
      </div>

      {visibleAssistants.length === 0 ? (
        <EmptyState
          icon={<Bot className="h-12 w-12" />}
          title="Nog geen assistenten"
          description={isPlatformAdmin ? 'Maak uw eerste AI-assistent aan om te beginnen met chatten' : 'Er zijn nog geen actieve assistenten beschikbaar'}
          {...(isPlatformAdmin ? { action: { label: 'Maak assistent', onClick: () => { setEditingAssistant(null); setModalOpen(true) } } } : {})}
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
                    <Badge variant="outline" className="text-xs">{assistantTypeLabel(a.type)}</Badge>
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
                {canManage && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => { setEditingAssistant(a); setModalOpen(true) }}
                    aria-label={isPlatformAdmin ? 'Assistent bewerken' : 'Kennisbronnen koppelen'}
                    title={isPlatformAdmin ? 'Assistent bewerken' : 'Kennisbronnen koppelen'}
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
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
        isPlatformAdmin={isPlatformAdmin}
      />
    </div>
  )
}

function AssistantModal({
  open,
  onOpenChange,
  assistant,
  organizationId,
  isPlatformAdmin,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  assistant: AIAssistant | null
  organizationId: string
  isPlatformAdmin: boolean
}) {
  const { toast } = useToast()
  const { data: availableKBs } = useKnowledgeBases(organizationId || undefined)
  const { data: linkedKBIds } = useAssistantKBLinks(assistant?.id)
  const kbMutation = useUpdateAssistantKnowledgeBases(organizationId)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('🤖')
  const [type, setType] = useState('chat')
  const [exampleQuestions, setExampleQuestions] = useState('')
  const [exampleQuestionsError, setExampleQuestionsError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedKBIds, setSelectedKBIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (assistant) {
      setName(assistant.name)
      setDescription(assistant.description ?? '')
      setIcon(assistant.icon ?? '🤖')
      setType(assistant.type ?? 'chat')
      setExampleQuestions((assistant.example_questions ?? []).join('\n'))
      setSelectedKBIds(linkedKBIds ?? new Set())
    } else {
      setName('')
      setDescription('')
      setIcon('🤖')
      setType('chat')
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

    try {
      if (isPlatformAdmin) {
        const definition = {
          name: name.trim(),
          description: description.trim() || null,
          icon: icon.trim() || '🤖',
          type,
          example_questions: parsedExampleQuestions,
        }

        const { catalog_id } = await saveCatalogAssistant({
          id: assistant?.catalog_id ?? null,
          ...definition,
        })

        // A new assistant got a row in every organization; find this
        // organization's row before linking knowledge sources.
        let assistantId = assistant?.id
        if (!assistantId) {
          const { data, error } = await supabase
            .from('ai_assistants')
            .select('id')
            .eq('organization_id', organizationId)
            .eq('catalog_id', catalog_id)
            .single()
          if (error) throw error
          assistantId = data.id
        }

        await kbMutation.mutateAsync({ assistantId, kbIds: [...selectedKBIds] })
        toast({
          title: assistant ? 'Assistent bijgewerkt' : 'Assistent aangemaakt',
          description: assistant
            ? `${definition.name} is bijgewerkt voor alle organisaties`
            : `${definition.name} staat bij alle organisaties aan`,
        })
      } else {
        if (!assistant) throw new Error('Alleen de platformbeheerder kan assistenten aanmaken.')
        await kbMutation.mutateAsync({ assistantId: assistant.id, kbIds: [...selectedKBIds] })
        toast({ title: 'Kennisbronnen bijgewerkt', description: `${assistant.name} is bijgewerkt` })
      }

      onOpenChange(false)
    } catch (err) {
      toast({ title: 'Fout', description: err instanceof Error ? err.message : 'Onbekende fout', variant: 'destructive' })
    } finally {
      setIsSaving(false)
    }
  }

  const knowledgeBlock = (
    <div className="flex flex-col gap-2">
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
  )

  const dialogTitle = isPlatformAdmin
    ? (assistant ? 'Assistent bewerken' : 'Nieuwe assistent')
    : `Kennisbronnen voor ${assistant?.name ?? ''}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <form onSubmit={handleSave}>
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          {isPlatformAdmin && (
            <DialogDescription>
              Wijzigingen gelden voor alle organisaties.
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogContent className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
          {isPlatformAdmin && (
            <>
              <div className="flex gap-4">
                <div className="flex flex-col gap-2 w-20">
                  <Label htmlFor="icon">Icoon</Label>
                  <Input id="icon" value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="🤖" maxLength={4} className="text-center text-xl" />
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
                <Label htmlFor="example-questions">Voorbeeldvragen (één per regel, maximaal 4)</Label>
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
              <div className="flex flex-col gap-2 border-t pt-4">
                <Label>Kennisbronnen</Label>
                {knowledgeBlock}
              </div>
            </>
          )}

          {!isPlatformAdmin && knowledgeBlock}
        </DialogContent>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
          <Button type="submit" disabled={isSaving || !!exampleQuestionsError}>{isSaving ? 'Opslaan...' : 'Opslaan'}</Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}

export default AssistantsPage
