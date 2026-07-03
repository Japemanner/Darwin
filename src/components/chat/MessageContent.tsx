import { useMemo } from 'react'
import { sanitizeHtml } from '@/lib/sanitize'

interface MessageContentProps {
  content: string
}

export function MessageContent({ content }: MessageContentProps) {
  const html = useMemo(() => sanitizeHtml(content), [content])

  return (
    <div dangerouslySetInnerHTML={{ __html: html }} />
  )
}