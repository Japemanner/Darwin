import { useEffect, useRef } from 'react'
import { Spinner } from '@/components/ui/spinner'
import { MessageBubble, type ChatMessage } from './MessageBubble'

interface MessageListProps {
  messages: ChatMessage[]
  isSending: boolean
  slowNotice: boolean
  conversationId: string | undefined
  assistantId: string | undefined
  onRetry: (message: ChatMessage) => void
  onCopy: (content: string) => void
}

export function MessageList({ messages, isSending, slowNotice, conversationId, assistantId, onRetry, onCopy }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, isSending, slowNotice])

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          conversationId={conversationId}
          assistantId={assistantId}
          onRetry={onRetry}
          onCopy={onCopy}
        />
      ))}
      {isSending && (
        <div className="flex justify-start" aria-live="polite">
          <div className="bg-muted rounded-lg px-4 py-2 text-sm flex flex-col gap-1">
            <span className="flex items-center gap-2">
              <Spinner className="h-3 w-3" /> Antwoord wordt opgesteld…
            </span>
            {slowNotice && <span>Dit duurt langer dan gebruikelijk.</span>}
          </div>
        </div>
      )}
    </div>
  )
}