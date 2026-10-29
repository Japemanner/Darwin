import { useMemo } from 'react'
import { sanitizeMarkdown } from '@/lib/sanitize'
import { cn } from '@/lib/utils'

interface MessageContentProps {
  content: string
  role: 'user' | 'assistant'
}

// Sanitized markdown elements cannot carry classes (dangerouslySetInnerHTML),
// so the container styles the named descendants via arbitrary variants
// (research #2). No @tailwindcss/typography — deliberately not installed.
const MARKDOWN_STYLES = cn(
  '[&_p]:mt-2 [&_p]:first:mt-0',
  '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5',
  '[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5',
  '[&_li]:my-0.5',
  '[&_strong]:font-semibold',
  '[&_table]:my-2 [&_table]:w-full [&_table]:border-collapse',
  '[&_th]:border [&_th]:px-2 [&_th]:py-1',
  '[&_td]:border [&_td]:px-2 [&_td]:py-1',
)

export function MessageContent({ content, role }: MessageContentProps) {
  const html = useMemo(
    () => (role === 'assistant' ? sanitizeMarkdown(content) : ''),
    [content, role],
  )

  // User input renders literally: React escapes markup so typed tags stay
  // visible as text (US5); line breaks come from whitespace-pre-wrap on the
  // user bubble.
  if (role === 'user') {
    return <div>{content}</div>
  }

  return (
    <div className={MARKDOWN_STYLES} dangerouslySetInnerHTML={{ __html: html }} />
  )
}