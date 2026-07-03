import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { MessageContent } from '@/components/chat/MessageContent'
import type { AIAssistant, Conversation, Message } from '@/types/database.types'
import { History, X, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react'

interface ConversationWithAssistant extends Conversation {
  ai_assistants: { name: string; icon: string } | null
}

interface Source {
  knowledge_item_id?: string
  title?: string
  excerpt?: string
  score?: number
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('nl-NL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function HistoryPage() {
  const { profile } = useAuth()
  const [conversations, setConversations] = useState<ConversationWithAssistant[]>([])
  const [assistants, setAssistants] = useState<AIAssistant[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filterAssistantId, setFilterAssistantId] = useState('all')

  const loadConversations = useCallback(async () => {
    if (!profile) return
    let query = supabase
      .from('conversations')
      .select('*, ai_assistants(name, icon)')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })

    if (filterAssistantId !== 'all') {
      query = query.eq('assistant_id', filterAssistantId)
    }

    const { data, error } = await query
    if (!error && data) setConversations(data as ConversationWithAssistant[])
    setIsLoading(false)
  }, [profile, filterAssistantId])

  const loadAssistants = useCallback(async () => {
    if (!profile) return
    const { data, error } = await supabase
      .from('ai_assistants')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .order('name', { ascending: true })
    if (!error && data) setAssistants(data)
  }, [profile])

  useEffect(() => {
    loadAssistants()
  }, [loadAssistants])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  const assistantOptions = [
    { value: 'all', label: 'Alle assistenten' },
    ...assistants.map((a) => ({ value: a.id, label: `${a.icon} ${a.name}` })),
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Geschiedenis</h1>
          <p className="text-muted-foreground">Alle eerdere runs van je assistenten</p>
        </div>
        <div className="w-48">
          <Select
            value={filterAssistantId}
            onValueChange={setFilterAssistantId}
            options={assistantOptions}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-6 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : conversations.length === 0 ? (
        <EmptyState
          icon={<History className="h-12 w-12" />}
          title="Nog geen runs"
          description="Zodra je met een assistent chatten, verschijnen de runs hier"
        />
      ) : (
        <div className="space-y-2">
          {conversations.map((conv) => (
            <ConversationRow key={conv.id} conversation={conv} />
          ))}
        </div>
      )}
    </div>
  )
}

function ConversationRow({ conversation }: { conversation: ConversationWithAssistant }) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  const assistantName = conversation.ai_assistants?.name ?? 'Onbekend'
  const assistantIcon = conversation.ai_assistants?.icon ?? '🤖'

  return (
    <>
      <Card
        className="cursor-pointer hover:border-primary/50 transition-colors"
        onClick={() => setDrawerOpen(true)}
      >
        <CardContent className="p-4 flex items-center gap-4">
          <div className="flex items-center justify-center h-10 w-10 rounded-full bg-muted text-xl shrink-0">
            {assistantIcon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{conversation.title}</p>
            <p className="text-sm text-muted-foreground truncate">
              {assistantName} · {formatDate(conversation.created_at)}
            </p>
          </div>
          <Badge variant="outline" className="shrink-0">
            <MessageSquare className="h-3 w-3 mr-1" />
            {formatDate(conversation.updated_at) !== formatDate(conversation.created_at) ? 'Afgerond' : 'Nieuw'}
          </Badge>
        </CardContent>
      </Card>

      {drawerOpen && (
        <ConversationDrawer
          conversation={conversation}
          assistantName={assistantName}
          assistantIcon={assistantIcon}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </>
  )
}

function ConversationDrawer({
  conversation,
  assistantName,
  assistantIcon,
  onClose,
}: {
  conversation: ConversationWithAssistant
  assistantName: string
  assistantIcon: string
  onClose: () => void
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set())
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function loadMessages() {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true })
      if (!error && data) setMessages(data)
      setIsLoading(false)
    }
    loadMessages()
  }, [conversation.id])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [messages])

  const toggleSources = (messageId: string) => {
    setExpandedSources((prev) => {
      const next = new Set(prev)
      if (next.has(messageId)) next.delete(messageId)
      else next.add(messageId)
      return next
    })
  }

  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-[480px] bg-background border-l shadow-2xl z-40 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <span className="text-xl">{assistantIcon}</span>
          <div className="min-w-0">
            <h2 className="font-semibold truncate">{conversation.title}</h2>
            <p className="text-xs text-muted-foreground">
              {assistantName} · {formatDate(conversation.created_at)}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner className="h-6 w-6" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm mt-8">
            Geen berichten in deze run
          </p>
        ) : (
          messages.map((msg) => (
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
          ))
        )}
      </div>
    </div>
  )
}

export default HistoryPage