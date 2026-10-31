// Single source of truth for how stored roles are displayed (feature 017,
// FR-005). Stored values stay 'admin' / 'member' — only the label is Dutch.
export const ROLE_LABELS: Record<'admin' | 'member', string> = {
  admin: 'Beheerder',
  member: 'Adviseur',
}

export function roleLabel(role: string | null | undefined): string {
  if (role === 'admin' || role === 'member') return ROLE_LABELS[role]
  return 'Geen rol'
}

// Readable assistant type labels (feature 010, FR-001; shared with the
// platform organisation screen in feature 019). Stored values stay English.
export const ASSISTANT_TYPE_LABELS: Record<string, string> = {
  chat: 'Chat',
  risico_analyse: 'Risico-analyse',
}

export function assistantTypeLabel(type: string | null | undefined): string {
  if (!type) return ''
  return ASSISTANT_TYPE_LABELS[type] ?? type
}
