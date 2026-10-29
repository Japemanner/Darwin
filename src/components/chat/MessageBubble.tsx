import { useState } from 'react'
import { ChevronDown, ChevronUp, Copy, RotateCcw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MessageContent } from './MessageContent'
import { AnswerFeedback } from './AnswerFeedback'

// In-memory chat message: persisted fields plus UI-only status. The id of a
// user message is the client-generated message_id reused on retry (FR-009).
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  // Sources arrive either from a persisted message row (JSONB) or from the
  // rag-chat response (RagSource[]); consumers narrow with Array.isArray.
  sources: unknown
  created_at: string
  status: 'pending' | 'sent' | 'failed'
  error?: { code: string; message: string }
}

interface Source {
  knowledge_item_id?: string
  title?: string
  excerpt?: string
  score?: number
}

interface MessageBubbleProps {
  message: ChatMessage
  // Feedback context: only present once the conversation id is known — after
  // the first answer (v2 response) or on an existing-conversation page.
  conversationId: string | undefined
  assistantId: string | undefined
  onRetry: (message: ChatMessage) => void
  onCopy: (content: string) => void
}

export function MessageBubble({ message, conversationId, assistantId, onRetry, onCopy }: MessageBubbleProps) {
  const [sourcesExpanded, setSourcesExpanded] = useState(false)
  const sources = Array.isArray(message.sources) ? (message.sources as Source[]) : []
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div className="flex flex-col gap-1 max-w-[80%]">
        <div
          className={cn(
            'rounded-lg px-4 py-2 text-sm',
            isUser
              ? 'bg-primary text-primary-foreground whitespace-pre-wrap'
              : 'bg-muted',
          )}
        >
          <MessageContent content={message.content} role={message.role} />
        </div>
        {isUser && message.status === 'failed' && message.error && (
          <div role="alert" className="flex flex-col items-end gap-1.5">
            <p className="text-xs text-destructive">{message.error.message}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => onRetry(message)}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Opnieuw proberen
            </Button>
          </div>
        )}
        {!isUser && sources.length > 0 && (
          <div className="text-xs">
            <button
              type="button"
              onClick={() => setSourcesExpanded((prev) => !prev)}
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              {sourcesExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              Bronnen ({sources.length})
            </button>
            {sourcesExpanded && (
              <div className="mt-2 space-y-2">
                {sources.map((source, idx) => (
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
        {!isUser && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start text-muted-foreground h-7"
            onClick={() => onCopy(message.content)}
          >
            <Copy className="h-3.5 w-3.5 mr-1.5" /> Kopiëren
          </Button>
        )}
        {!isUser && message.status === 'sent' && conversationId && assistantId && (
          <AnswerFeedback conversationId={conversationId} assistantId={assistantId} messageId={message.id} />
        )}
      </div>
    </div>
  )
}