import { useState } from 'react'
import { ThumbsDown, ThumbsUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useMessageFeedback, useUpsertMessageFeedback, type MessageFeedbackPayload } from '@/hooks/queries'
import { useToast } from '@/components/ui/toast'

const FEEDBACK_ERROR_TOAST = 'Kon uw beoordeling niet opslaan. Probeer het opnieuw.'

// Reason codes and Dutch labels — the DB CHECK in migration 017 and
// contracts/feedback-db.md §1 define the code list.
const REASONS = [
  { value: 'incorrect', label: 'Onjuist' },
  { value: 'incomplete', label: 'Onvolledig' },
  { value: 'wrong_source', label: 'Bron klopt niet' },
  { value: 'misunderstood', label: 'Vraag niet begrepen' },
  { value: 'other', label: 'Anders' },
] as const

type ReasonCode = (typeof REASONS)[number]['value']

interface AnswerFeedbackProps {
  conversationId: string
  assistantId: string
  messageId: string
}

// Per-answer rating (feature 012): thumbs up saves directly, thumbs down
// opens the reason form (a reason is required, a comment is optional —
// FR-003). aria-pressed reflects the STORED rating (FR-012) and a changed
// rating fully overwrites the previous one — thumbs up always sends
// reason/feedback null (FR-005). Errors surface as a Dutch toast and leave
// the buttons usable (FR-008, constitution V).
export function AnswerFeedback({ conversationId, assistantId, messageId }: AnswerFeedbackProps) {
  const { profile } = useAuth()
  const { toast } = useToast()
  const { data: feedbackRows } = useMessageFeedback(conversationId)
  const upsertFeedback = useUpsertMessageFeedback(conversationId)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [reason, setReason] = useState<ReasonCode | null>(null)
  const [comment, setComment] = useState('')

  if (!profile) return null

  const existing = feedbackRows?.find((row) => row.message_id === messageId) ?? null

  async function submitRating(payload: Omit<MessageFeedbackPayload, 'assistant_id' | 'message_id'>): Promise<boolean> {
    setIsSubmitting(true)
    try {
      await upsertFeedback.mutateAsync({
        message_id: messageId,
        assistant_id: assistantId,
        ...payload,
      })
      return true
    } catch {
      toast({ title: 'Fout', description: FEEDBACK_ERROR_TOAST, variant: 'destructive' })
      return false
    } finally {
      setIsSubmitting(false)
    }
  }

  function closeForm() {
    setFormOpen(false)
    setReason(null)
    setComment('')
  }

  function handleThumbsUp() {
    if (isSubmitting) return
    closeForm()
    // Thumbs up clears a former reason/comment — full overwrite (FR-005).
    void submitRating({ thumbs_up: true, reason: null, feedback: null })
  }

  // Thumbs down opens the reason form; no prefill of a previous rating
  // (FR-003, spec assumption). US3 keeps this path for changing a rating.
  function handleThumbsDown() {
    if (isSubmitting) return
    setReason(null)
    setComment('')
    setFormOpen(true)
  }

  async function handleThumbsDownSubmit() {
    if (!reason || isSubmitting) return
    const trimmed = comment.trim()
    const success = await submitRating({ thumbs_up: false, reason, feedback: trimmed ? trimmed : null })
    if (success) closeForm()
  }

  return (
    <div className="flex flex-col gap-1.5 items-start">
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
      {formOpen && (
        <form
          className="flex flex-col gap-2 w-full max-w-sm"
          onSubmit={(e) => {
            e.preventDefault()
            void handleThumbsDownSubmit()
          }}
        >
          <fieldset className="flex flex-col gap-1">
            <legend className="text-sm text-muted-foreground mb-1">Wat ging er mis?</legend>
            {REASONS.map((r) => (
              <label key={r.value} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={`feedback-reason-${messageId}`}
                  value={r.value}
                  checked={reason === r.value}
                  onChange={() => setReason(r.value)}
                  className="h-4 w-4"
                />
                {r.label}
              </label>
            ))}
          </fieldset>
          <Label htmlFor={`feedback-comment-${messageId}`} className="text-muted-foreground">
            Toelichting (optioneel)
          </Label>
          <Textarea
            id={`feedback-comment-${messageId}`}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Beschrijf eventueel wat er niet goed was aan dit antwoord"
            rows={2}
            className="resize-none"
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={closeForm} disabled={isSubmitting}>
              Annuleren
            </Button>
            <Button type="submit" size="sm" disabled={!reason || isSubmitting}>
              {isSubmitting ? 'Versturen…' : 'Versturen'}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}