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
