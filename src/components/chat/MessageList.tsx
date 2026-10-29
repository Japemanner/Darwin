import { useCallback, useEffect, useRef, useState } from 'react'
import { Spinner } from '@/components/ui/spinner'
import type { BronRef } from '@/lib/analysis-schemas'
import { SourcePanel } from '@/components/analysis/SourcePanel'
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

// The open source panel: the mapped sources of one answer plus the source
// button that opened it (focus returns there on close, FR-010).
interface OpenBron {
  bronnen: BronRef[]
  bronId: string
  trigger: HTMLButtonElement
}

export function MessageList({ messages, isSending, slowNotice, conversationId, assistantId, onRetry, onCopy }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [openBron, setOpenBron] = useState<OpenBron | null>(null)

  const handleOpenBron = useCallback((bronnen: BronRef[], bronId: string, trigger: HTMLButtonElement) => {
    // Replacing the state means only one panel can ever be open (FR-012).
    setOpenBron({ bronnen, bronId, trigger })
  }, [])

  // Close restores focus to the source button that opened the panel; the
  // isConnected guard covers navigation where the button is gone (FR-010).
  const closeBron = useCallback(() => {
    if (openBron && openBron.trigger.isConnected) openBron.trigger.focus()
    setOpenBron(null)
  }, [openBron])

  // Escape closes the panel while it is open (ui/dialog.tsx pattern).
  useEffect(() => {
    if (!openBron) return
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeBron()
    }
    document.addEventListener('keydown', handleKeydown)
    return () => document.removeEventListener('keydown', handleKeydown)
  }, [openBron, closeBron])

  // Navigating to another conversation closes any open panel — no focus
  // restore there (the old messages are gone).
  useEffect(() => {
    setOpenBron(null)
  }, [conversationId])

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
          onOpenBron={handleOpenBron}
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
      <SourcePanel
        bronId={openBron?.bronId ?? null}
        bronnen={openBron?.bronnen ?? []}
        onClose={closeBron}
      />
    </div>
  )
}