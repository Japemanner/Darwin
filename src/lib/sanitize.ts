import DOMPurify from 'dompurify'

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'span', 'div',
  'h1', 'h2', 'h3', 'blockquote', 'code', 'pre',
]

const ALLOWED_ATTR = ['href', 'title', 'target', 'rel']

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