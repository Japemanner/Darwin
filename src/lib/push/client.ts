import { supabase } from '@/lib/supabase'
import type { PushErrorCode } from './types'

// Web Push client for this device (feature 018).
// Contract: specs/018-push-notifications/contracts/push-payload.md
// The VAPID public key is non-secret and deployment-wide; the private key
// never leaves the server.

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY
const SERVICE_WORKER_URL = '/sw.js'
const TABLE = 'push_subscriptions'

export class PushClientError extends Error {
  readonly code: PushErrorCode

  constructor(code: PushErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window.PushManager !== 'undefined' &&
    typeof window.Notification !== 'undefined'
  )
}

export function isPushConfigured(): boolean {
  return typeof VAPID_PUBLIC_KEY === 'string' && VAPID_PUBLIC_KEY.length > 0
}

// base64url → bytes for applicationServerKey. Deliberately not crypto.subtle:
// the frontend must contain no client-side crypto (fitness check F-18).
function decodeBase64Url(value: string): Uint8Array {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const bytes = new Uint8Array(raw.length)
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index)
  }
  return bytes
}

async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  try {
    return await navigator.serviceWorker.register(SERVICE_WORKER_URL)
  } catch {
    throw new PushClientError(
      'SERVICE_WORKER_FAILED',
      'De meldingsdienst kon niet worden gestart.',
    )
  }
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) {
    throw new PushClientError('SERVICE_WORKER_FAILED', 'Meldingen worden niet ondersteund.')
  }
  const existing = await navigator.serviceWorker.getRegistration('/')
  if (existing) return existing
  return registerServiceWorker()
}

// The browser subscription is the device identity; a row links it to the user.
export async function getThisDeviceSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null
  const registration = await getRegistration()
  return registration.pushManager.getSubscription()
}

export async function readThisDeviceState(
  userId: string,
): Promise<{ subscription: PushSubscription | null; subscribed: boolean }> {
  const subscription = await getThisDeviceSubscription()
  if (!subscription) return { subscription: null, subscribed: false }

  const { data, error } = await supabase
    .from(TABLE)
    .select('id')
    .eq('user_id', userId)
    .eq('endpoint', subscription.endpoint)
    .limit(1)

  if (error) {
    throw new PushClientError('READ_FAILED', 'De meldingsstatus kon niet worden opgehaald.')
  }

  return { subscription, subscribed: (data?.length ?? 0) > 0 }
}

export async function subscribeThisDevice(userId: string): Promise<PushSubscription> {
  if (!isPushConfigured()) {
    throw new PushClientError('NOT_CONFIGURED', 'Meldingen zijn niet geconfigureerd.')
  }
  if (!isPushSupported()) {
    throw new PushClientError('SUBSCRIBE_FAILED', 'Meldingen worden niet ondersteund.')
  }

  const registration = await getRegistration()

  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeBase64Url(VAPID_PUBLIC_KEY!),
      })
    } catch {
      throw new PushClientError('SUBSCRIBE_FAILED', 'Meldingen konden niet worden aangezet.')
    }
  }

  const keys = subscription.toJSON().keys
  const p256dh = keys?.p256dh
  const auth = keys?.auth
  if (!p256dh || !auth) {
    throw new PushClientError('SUBSCRIBE_FAILED', 'Meldingen konden niet worden aangezet.')
  }

  // Delete + insert keeps the RLS surface at read/create/delete (research R5).
  const { error: deleteError } = await supabase
    .from(TABLE)
    .delete()
    .eq('user_id', userId)
    .eq('endpoint', subscription.endpoint)
  if (deleteError) {
    throw new PushClientError('SAVE_FAILED', 'Meldingen konden niet worden opgeslagen.')
  }

  const { error: insertError } = await supabase.from(TABLE).insert({
    user_id: userId,
    endpoint: subscription.endpoint,
    p256dh,
    auth,
  })
  if (insertError) {
    throw new PushClientError('SAVE_FAILED', 'Meldingen konden niet worden opgeslagen.')
  }

  return subscription
}

export async function unsubscribeThisDevice(userId: string): Promise<void> {
  const subscription = await getThisDeviceSubscription()
  // No subscription on this device means there is nothing to remove here;
  // never delete other devices' rows.
  if (!subscription) return

  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('user_id', userId)
    .eq('endpoint', subscription.endpoint)
  if (error) {
    throw new PushClientError('REMOVE_FAILED', 'Meldingen konden niet worden uitgezet.')
  }

  try {
    await subscription.unsubscribe()
  } catch {
    // The browser may already have dropped it; the row is gone either way.
  }
}

// Logout must never be blocked by a push failure.
export async function unsubscribeThisDeviceQuietly(userId: string): Promise<void> {
  try {
    await unsubscribeThisDevice(userId)
  } catch (error) {
    const code = error instanceof PushClientError ? error.code : 'REMOVE_FAILED'
    console.error('[push] Unsubscribe on logout failed:', code)
  }
}
