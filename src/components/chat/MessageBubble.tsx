import { Copy, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { BronRef } from '@/lib/analysis-schemas'
import type { RagSource, RagVerification } from '@/lib/rag-client'
import { MessageContent } from './MessageContent'
import { AnswerFeedback } from './AnswerFeedback'
import { AnswerMeta } from './AnswerMeta'

// In-memory chat message: persisted fields plus UI-only status. The id of a
// user message is the client-generated message_id reused on retry (FR-009).
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  // Sources arrive either from a persisted message row (JSONB) or from the
  // rag-chat response (RagSource[]); consumers narrow with Array.isArray.
  sources: unknown
  // Verification verdict from n8n: live from the rag-chat response, on
  // reload narrowed from the JSONB column (parseVerification). Absent or
  // null renders no verdict line (FR-007).
  verification?: RagVerification | null
  created_at: string
  status: 'pending' | 'sent' | 'failed'
  error?: { code: string; message: string }
}

interface MessageBubbleProps {
  message: ChatMessage
  // Feedback context: only present once the conversation id is known — after
  // the first answer (v2 response) or on an existing-conversation page.
  conversationId: string | undefined
  assistantId: string | undefined
  onRetry: (message: ChatMessage) => void
  onCopy: (content: string) => void
  // Opens the shared side panel for the sources of this answer (FR-009).
  onOpenBron: (bronnen: BronRef[], bronId: string, trigger: HTMLButtonElement) => void
}

export function MessageBubble({ message, conversationId, assistantId, onRetry, onCopy, onOpenBron }: MessageBubbleProps) {
  const sources = Array.isArray(message.sources) ? (message.sources as RagSource[]) : []
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
        {!isUser && (
          <AnswerMeta verification={message.verification} sources={sources} onOpenBron={onOpenBron} />
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