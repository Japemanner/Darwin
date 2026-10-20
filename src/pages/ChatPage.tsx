import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAssistant, useConversation, useConversationMessages } from '@/hooks/queries'
import { askAssistant, RagClientError } from '@/lib/rag-client'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import { ChatComposer, type ChatComposerHandle } from '@/components/chat/ChatComposer'
import { ChatEmptyState } from '@/components/chat/ChatEmptyState'
import { ChatHeader } from '@/components/chat/ChatHeader'
import { MessageList } from '@/components/chat/MessageList'
import type { ChatMessage } from '@/components/chat/MessageBubble'

const SLOW_NOTICE_MS = 15_000
const GENERIC_SEND_ERROR = 'Er ging iets mis bij het versturen. Probeer het opnieuw.'

interface AssistantView {
  id: string
  name: string
  icon: string
  description: string | null
  example_questions?: string[]
}

function ChatPage() {
  const { assistantId, conversationId: routeConversationId } = useParams()
  const isNew = !!assistantId
  const navigate = useNavigate()
  const location = useLocation()
  const qc = useQueryClient()
  const { toast } = useToast()

  // Mode data: /chat/new/:assistantId or /chat/:conversationId.
  const { data: newAssistant, isPending: assistantPending } = useAssistant(isNew ? assistantId : undefined)
  const { data: conversationRow, isPending: conversationPending } = useConversation(!isNew ? routeConversationId : undefined)
  const { data: conversationMessages } = useConversationMessages(!isNew ? routeConversationId : undefined)

  const embeddedAssistant = conversationRow?.ai_assistants ?? null
  const assistant: AssistantView | null = isNew ? (newAssistant ?? null) : embeddedAssistant
  // Snapshot so the header/chat keep rendering while the conversation detail
  // loads right after the first answer navigates /chat/new → /chat/:id.
  const [stableAssistant, setStableAssistant] = useState<AssistantView | null>(null)
  useEffect(() => {
    if (assistant) {
      setStableAssistant({
        id: assistant.id,
        name: assistant.name,
        icon: assistant.icon,
        description: assistant.description,
        example_questions: assistant.example_questions ?? [],
      })
    }
  }, [assistant])
  const viewAssistant = assistant ?? stableAssistant
  const loading = isNew
    ? assistantPending && !viewAssistant
    : conversationPending && !conversationRow && !viewAssistant

  // Local chat state; the id of a user message is its message_id (FR-009).
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [slowNotice, setSlowNotice] = useState(false)
  const composerRef = useRef<ChatComposerHandle>(null)
  const slowTimerRef = useRef<number | null>(null)
  // Skip one reset when the first answer navigates /chat/new → /chat/:id so the
  // locally added messages survive until the server data arrives.
  const skipResetRef = useRef(false)

  // Conversation id from the latest successful answer — the router param is
  // not yet updated in the frames between the first answer and the
  // navigate(replace) to /chat/:id, so per-answer feedback needs this
  // fallback (specs/012-per-answer-feedback/research.md #8).
  const [resultConversationId, setResultConversationId] = useState<string | null>(null)

  const resetChatState = useCallback(() => {
    setMessages([])
    setInput('')
    setIsSending(false)
    setSlowNotice(false)
    if (slowTimerRef.current !== null) {
      clearTimeout(slowTimerRef.current)
      slowTimerRef.current = null
    }
    setResultConversationId(null)
  }, [])

  // Reset local state when the route target changes (US7: "Nieuw gesprek",
  // browser back/forward between conversations).
  useEffect(() => {
    if (skipResetRef.current) {
      skipResetRef.current = false
      return
    }
    resetChatState()
  }, [assistantId, routeConversationId, resetChatState])

  // Unmount cleanup: never leave the slow-notice timer running.
  useEffect(() => () => {
    if (slowTimerRef.current !== null) clearTimeout(slowTimerRef.current)
  }, [])

  // Existing mode: seed the message list from the persisted conversation.
  useEffect(() => {
    if (isNew || !conversationMessages) return
    setMessages(
      conversationMessages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        sources: m.sources,
        created_at: m.created_at,
        status: 'sent' as const,
      })),
    )
  }, [isNew, routeConversationId, conversationMessages])

  const startSlowTimer = useCallback(() => {
    if (slowTimerRef.current !== null) clearTimeout(slowTimerRef.current)
    slowTimerRef.current = window.setTimeout(() => setSlowNotice(true), SLOW_NOTICE_MS)
  }, [])

  const clearSlowTimer = useCallback(() => {
    if (slowTimerRef.current !== null) {
      clearTimeout(slowTimerRef.current)
      slowTimerRef.current = null
    }
    setSlowNotice(false)
  }, [])

  const processQuestion = useCallback(
    async (userMessage: ChatMessage) => {
      if (!viewAssistant) return
      setIsSending(true)
      setSlowNotice(false)
      startSlowTimer()
      try {
        const result = await askAssistant({
          assistantId: viewAssistant.id,
          ...(routeConversationId ? { conversationId: routeConversationId } : {}),
          messageId: userMessage.id,
          message: userMessage.content,
        })
        clearSlowTimer()
        const assistantMessage: ChatMessage = {
          id: result.assistantMessage.id,
          role: 'assistant',
          content: result.assistantMessage.content,
          sources: result.assistantMessage.sources,
          created_at: result.assistantMessage.created_at,
          status: 'sent',
        }
        setMessages((prev) =>
          prev
            .map((m) => (m.id === userMessage.id ? { ...m, status: 'sent' as const, error: undefined } : m))
            .concat(assistantMessage),
        )
        qc.invalidateQueries({ queryKey: ['messages', result.conversationId] })
        qc.invalidateQueries({ queryKey: ['conversations'] })
        setResultConversationId(result.conversationId)
        if (!routeConversationId) {
          // First answer: the conversation gets its permanent address (US1).
          skipResetRef.current = true
          navigate(`/chat/${result.conversationId}`, { replace: true })
        }
      } catch (err) {
        clearSlowTimer()
        const ragError = err instanceof RagClientError ? err : null
        const errorText = ragError?.message ?? GENERIC_SEND_ERROR
        setMessages((prev) =>
          prev.map((m) =>
            m.id === userMessage.id
              ? { ...m, status: 'failed' as const, error: { code: ragError?.code ?? 'UNKNOWN', message: errorText } }
              : m,
          ),
        )
      } finally {
        setIsSending(false)
        composerRef.current?.focus()
      }
    },
    [viewAssistant, routeConversationId, navigate, qc, startSlowTimer, clearSlowTimer],
  )

  const sendMessage = useCallback(
    async (question: string) => {
      const trimmed = question.trim()
      if (!trimmed || !viewAssistant || isSending) return
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: trimmed,
        sources: null,
        created_at: new Date().toISOString(),
        status: 'pending',
      }
      setMessages((prev) => [...prev, userMessage])
      setInput('')
      await processQuestion(userMessage)
    },
    [viewAssistant, isSending, processQuestion],
  )

  const retryMessage = useCallback(
    async (failedMessage: ChatMessage) => {
      if (!viewAssistant || isSending || failedMessage.status !== 'failed') return
      setMessages((prev) =>
        prev.map((m) => (m.id === failedMessage.id ? { ...m, status: 'pending' as const, error: undefined } : m)),
      )
      await processQuestion({ ...failedMessage, status: 'pending', error: undefined })
    },
    [viewAssistant, isSending, processQuestion],
  )

  const handleNewConversation = useCallback(() => {
    if (!viewAssistant) return
    const target = `/chat/new/${viewAssistant.id}`
    if (location.pathname !== target) {
      navigate(target)
    } else {
      resetChatState()
    }
  }, [viewAssistant, location.pathname, navigate, resetChatState])

  const handleCopy = useCallback(
    async (content: string) => {
      try {
        await navigator.clipboard.writeText(content)
        toast({ title: 'Gekopieerd' })
      } catch {
        toast({ title: 'Kopiëren is mislukt', description: 'Kopieer de tekst handmatig uit het antwoord.', variant: 'destructive' })
      }
    },
    [toast],
  )

  const showEmptyState = messages.length === 0 && !isSending && (isNew || !!conversationMessages)

  // --- Loading state
  if (loading) {
    return (
      <div className="flex flex-col h-[calc(100vh-5rem)] lg:h-[calc(100vh-4rem)]">
        <div className="p-4 border-b">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-3 w-72 mt-2" />
        </div>
        <div className="flex-1 p-4 space-y-4">
          <Skeleton className="h-16 w-3/4" />
          <Skeleton className="h-16 w-2/3" />
        </div>
      </div>
    )
  }

  // --- Not-found states (FR-011; research.md #10). During the /chat/new →
  // /chat/:id transition viewAssistant keeps the page alive until the
  // conversation detail arrives.
  if (!isNew && !conversationRow && !viewAssistant) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <h1 className="text-xl font-semibold">Gesprek niet gevonden</h1>
        <p className="text-sm text-muted-foreground">Dit gesprek bestaat niet of u heeft er geen toegang toe.</p>
        <Button variant="outline" onClick={() => navigate('/assistants')}>Terug naar assistenten</Button>
      </div>
    )
  }
  if (isNew && (!newAssistant || newAssistant.type === 'risico_analyse' || !newAssistant.is_active)) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <h1 className="text-xl font-semibold">Assistent niet gevonden</h1>
        <p className="text-sm text-muted-foreground">Deze assistent bestaat niet of is niet beschikbaar voor een nieuw gesprek.</p>
        <Button variant="outline" onClick={() => navigate('/assistants')}>Terug naar assistenten</Button>
      </div>
    )
  }

  if (!viewAssistant) return null

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] lg:h-[calc(100vh-4rem)]">
      <ChatHeader
        assistant={{ id: viewAssistant.id, name: viewAssistant.name, icon: viewAssistant.icon, description: viewAssistant.description }}
        onNewConversation={handleNewConversation}
      />

      {showEmptyState ? (
        <ChatEmptyState
          assistantName={viewAssistant.name}
          description={viewAssistant.description}
          exampleQuestions={viewAssistant.example_questions ?? []}
          onAsk={(question) => sendMessage(question)}
          disabled={isSending}
        />
      ) : (
        <MessageList
          messages={messages}
          isSending={isSending}
          slowNotice={slowNotice}
          conversationId={routeConversationId ?? resultConversationId ?? undefined}
          assistantId={viewAssistant.id}
          onRetry={retryMessage}
          onCopy={handleCopy}
        />
      )}

      <ChatComposer
        ref={composerRef}
        value={input}
        onChange={setInput}
        onSubmit={() => sendMessage(input)}
        isSending={isSending}
      />
    </div>
  )
}

export default ChatPage