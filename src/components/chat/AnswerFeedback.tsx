import { useState } from 'react'
import { ThumbsDown, ThumbsUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useMessageFeedback, useUpsertMessageFeedback } from '@/hooks/queries'
import { useToast } from '@/components/ui/toast'

const FEEDBACK_ERROR_TOAST = 'Kon uw beoordeling niet opslaan. Probeer het opnieuw.'

interface AnswerFeedbackProps {
  conversationId: string
  assistantId: string
  messageId: string
}

// Per-answer rating (feature 012): thumbs up/down per assistant message with
// aria-pressed reflecting the STORED rating (FR-012). Thumbs up saves
// directly; a changed rating fully overwrites the previous one — thumbs up
// always sends reason/feedback null (FR-005). Errors surface as a Dutch
// toast and leave the buttons usable (FR-008, constitution V).
export function AnswerFeedback({ conversationId, assistantId, messageId }: AnswerFeedbackProps) {
  const { profile } = useAuth()
  const { toast } = useToast()
  const { data: feedbackRows } = useMessageFeedback(conversationId)
  const upsertFeedback = useUpsertMessageFeedback(conversationId)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!profile) return null

  const existing = feedbackRows?.find((row) => row.message_id === messageId) ?? null

  async function submitRating(thumbsUp: boolean): Promise<boolean> {
    setIsSubmitting(true)
    try {
      await upsertFeedback.mutateAsync({
        message_id: messageId,
        assistant_id: assistantId,
        thumbs_up: thumbsUp,
        reason: null,
        feedback: null,
      })
      return true
    } catch {
      toast({ title: 'Fout', description: FEEDBACK_ERROR_TOAST, variant: 'destructive' })
      return false
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleThumbsUp() {
    if (isSubmitting) return
    void submitRating(true)
  }

  // Interim US1 behavior: thumbs down saves directly without a reason, so US1
  // is independently testable. US2 replaces this with the reason form (FR-003).
  function handleThumbsDown() {
    if (isSubmitting) return
    void submitRating(false)
  }

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Beoordeling van dit antwoord">
      <button
        type="button"
        onClick={handleThumbsUp}
        disabled={isSubmitting}
        aria-pressed={existing?.thumbs_up === true}
        aria-label="Antwoord is nuttig"
        title="Antwoord is nuttig"
        className={cn(
          'p-1.5 rounded-full transition-colors',
          existing?.thumbs_up === true
            ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
            : 'hover:bg-accent text-muted-foreground hover:text-foreground',
        )}
      >
        <ThumbsUp className={cn('h-4 w-4', existing?.thumbs_up === true && 'fill-current')} />
      </button>
      <button
        type="button"
        onClick={handleThumbsDown}
        disabled={isSubmitting}
        aria-pressed={existing?.thumbs_up === false}
        aria-label="Antwoord is niet nuttig"
        title="Antwoord is niet nuttig"
        className={cn(
          'p-1.5 rounded-full transition-colors',
          existing?.thumbs_up === false
            ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
            : 'hover:bg-accent text-muted-foreground hover:text-foreground',
        )}
      >
        <ThumbsDown className={cn('h-4 w-4', existing?.thumbs_up === false && 'fill-current')} />
      </button>
    </div>
  )
}