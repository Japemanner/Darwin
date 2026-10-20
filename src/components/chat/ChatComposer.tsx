import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

// Cap auto-growth at ~8 lines (text-sm leading-6 = 24px per line + padding).
const MAX_COMPOSER_HEIGHT_PX = 8 * 24 + 8

export interface ChatComposerHandle {
  focus: () => void
}

interface ChatComposerProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  isSending: boolean
}

export const ChatComposer = forwardRef<ChatComposerHandle, ChatComposerProps>(
  function ChatComposer({ value, onChange, onSubmit, isSending }, ref) {
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const canSend = value.trim().length > 0 && !isSending

    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
    }))

    useEffect(() => {
      const el = textareaRef.current
      if (!el) return
      el.style.height = '0px'
      el.style.height = `${Math.min(el.scrollHeight, MAX_COMPOSER_HEIGHT_PX)}px`
      el.style.overflowY = el.scrollHeight > MAX_COMPOSER_HEIGHT_PX ? 'auto' : 'hidden'
    }, [value])

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        if (canSend) onSubmit()
      }
    }

    return (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (canSend) onSubmit()
        }}
        className="border-t p-4 flex gap-2 items-end"
      >
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Typ uw bericht…"
          aria-label="Bericht"
          disabled={isSending}
          rows={1}
          className="resize-none min-h-[40px] flex-1"
        />
        <Button type="submit" size="icon" disabled={!canSend} aria-label="Versturen">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    )
  },
)