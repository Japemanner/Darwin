// Shared types for Web Push notifications (feature 018).

export type PushKind = 'analysis_succeeded' | 'analysis_failed'

export type PushStatus =
  | 'determining'
  | 'unsupported'
  | 'blocked'
  | 'off'
  | 'on'
  | 'working'
  | 'error'

export type PushErrorCode =
  | 'NOT_CONFIGURED'
  | 'PERMISSION_BLOCKED'
  | 'SUBSCRIBE_FAILED'
  | 'SERVICE_WORKER_FAILED'
  | 'READ_FAILED'
  | 'SAVE_FAILED'
  | 'REMOVE_FAILED'

// The notification text is fixed by the spec: no client content, no advice
// (constitution II and III). The service worker uses the same strings.
export const PUSH_TEXTS = {
  analysis_succeeded: 'Uw risico-analyse is gereed',
  analysis_failed: 'Uw risico-analyse is mislukt',
} as const satisfies Record<PushKind, string>
