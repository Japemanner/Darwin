// Pure logic for the push-send Edge Function (feature 018).
// No Deno or Supabase APIs here so it can be unit-tested with `node --test`.
// Contract: specs/018-push-notifications/contracts/push-send.md

export const PUSH_KINDS = ['analysis_succeeded', 'analysis_failed'] as const
export type PushKind = (typeof PUSH_KINDS)[number]

export interface PushSubscriptionRow {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

export interface DeliveryCounts {
  sent: number
  removed: number
  failed: number
}

export interface ValidatedRequest {
  userId: string
  kind: PushKind
  runId: string
}

export type ValidationResult =
  | { ok: true; value: ValidatedRequest }
  | { ok: false; code: 'VALIDATION' }

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ANALYSIS_URL =
  /^\/analyse\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i

export function isPushKind(value: unknown): value is PushKind {
  return typeof value === 'string' && (PUSH_KINDS as readonly string[]).includes(value)
}

export function validateRequest(body: unknown): ValidationResult {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, code: 'VALIDATION' }
  }

  const { user_id: userId, kind, url } = body as Record<string, unknown>

  if (typeof userId !== 'string' || !UUID.test(userId)) {
    return { ok: false, code: 'VALIDATION' }
  }
  if (!isPushKind(kind)) {
    return { ok: false, code: 'VALIDATION' }
  }
  if (typeof url !== 'string') {
    return { ok: false, code: 'VALIDATION' }
  }

  // Only relative paths for a known kind — never an absolute URL.
  const match = ANALYSIS_URL.exec(url)
  if (!match || !match[1]) {
    return { ok: false, code: 'VALIDATION' }
  }

  return {
    ok: true,
    value: {
      userId: userId.toLowerCase(),
      kind,
      runId: match[1].toLowerCase(),
    },
  }
}

// The push payload carries exactly two fields — never client content.
export function buildPayload(kind: PushKind, runId: string): string {
  return JSON.stringify({ kind, run_id: runId })
}

// 404 and 410 both mean the subscription is no longer valid (web-push
// convention; the library's isGone() only checks 410).
export function isGoneStatus(status: number): boolean {
  return status === 404 || status === 410
}

export function statusFromError(error: unknown): number | null {
  if (typeof error !== 'object' || error === null || !('response' in error)) {
    return null
  }
  const response = (error as { response?: { status?: unknown } }).response
  return response && typeof response.status === 'number' ? response.status : null
}

export function secureCompare(a: string, b: string): boolean {
  if (a.length === 0 || a.length !== b.length) return false
  let difference = 0
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index)
  }
  return difference === 0
}

export async function deliver(
  subscriptions: PushSubscriptionRow[],
  push: (subscription: PushSubscriptionRow) => Promise<void>,
  hooks: {
    onGone: (subscriptionId: string) => Promise<void>
    onError: (info: { subscriptionId: string; status: number | null }) => void
  },
): Promise<DeliveryCounts> {
  const counts: DeliveryCounts = { sent: 0, removed: 0, failed: 0 }

  for (const subscription of subscriptions) {
    try {
      await push(subscription)
      counts.sent += 1
      continue
    } catch (error) {
      const status = statusFromError(error)

      if (status !== null && isGoneStatus(status)) {
        try {
          await hooks.onGone(subscription.id)
          counts.removed += 1
          continue
        } catch {
          counts.failed += 1
          hooks.onError({ subscriptionId: subscription.id, status })
          continue
        }
      }

      counts.failed += 1
      hooks.onError({ subscriptionId: subscription.id, status })
    }
  }

  return counts
}
