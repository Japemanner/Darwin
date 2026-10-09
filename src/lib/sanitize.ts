import DOMPurify from 'dompurify'
import { marked } from 'marked'

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'span', 'div',
  'h1', 'h2', 'h3', 'blockquote', 'code', 'pre',
]

const ALLOWED_ATTR = ['href', 'title', 'target', 'rel']

const MARKDOWN_ALLOWED_TAGS = [
  ...ALLOWED_TAGS,
  'h4', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
]

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if ('tagName' in node && node.tagName === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

export function sanitizeHtml(dirty: string): string {
  if (!dirty) return ''
  return DOMPurify.sanitize(dirty, { ALLOWED_TAGS, ALLOWED_ATTR })
}

export function sanitizeMarkdown(markdown: string): string {
  if (!markdown) return ''
  const html = marked.parse(markdown, { async: false }) as string
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: MARKDOWN_ALLOWED_TAGS, ALLOWED_ATTR })
}