import { useCallback, useEffect, useState } from 'react'
import {
  PushClientError,
  isPushConfigured,
  isPushSupported,
  readThisDeviceState,
  subscribeThisDevice,
  unsubscribeThisDevice,
} from '@/lib/push/client'
import type { PushErrorCode, PushStatus } from '@/lib/push/types'

type PushAction = 'enable' | 'disable'

function errorCodeOf(error: unknown, fallback: PushErrorCode): PushErrorCode {
  return error instanceof PushClientError ? error.code : fallback
}

// Per-device notification state for the sidebar user block (feature 018).
// The state is derived from browser support, the permission and the
// push_subscriptions row for this device's endpoint.
export function usePushSubscription(userId: string | undefined) {
  const [status, setStatus] = useState<PushStatus>('determining')
  const [errorCode, setErrorCode] = useState<PushErrorCode | null>(null)
  const [lastAction, setLastAction] = useState<PushAction>('enable')

  const refresh = useCallback(
    async (silent = false) => {
      if (!userId) {
        setStatus('determining')
        return
      }

      setErrorCode(null)

      if (!isPushSupported()) {
        setStatus('unsupported')
        return
      }
      if (!isPushConfigured()) {
        setStatus('error')
        setErrorCode('NOT_CONFIGURED')
        return
      }
      if (Notification.permission === 'denied') {
        setStatus('blocked')
        return
      }

      if (!silent) setStatus('determining')

      try {
        const { subscribed } = await readThisDeviceState(userId)
        setStatus(subscribed ? 'on' : 'off')
      } catch (error) {
        setErrorCode(errorCodeOf(error, 'READ_FAILED'))
        setStatus('error')
      }
    },
    [userId],
  )

  useEffect(() => {
    void refresh()
  }, [refresh])

  // The permission can change in the browser settings while the app is open.
  useEffect(() => {
    const onFocus = () => void refresh(true)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refresh(true)
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [refresh])

  const enable = useCallback(async () => {
    if (!userId) return

    setLastAction('enable')
    setErrorCode(null)

    if (!isPushSupported()) {
      setStatus('unsupported')
      return
    }
    if (!isPushConfigured()) {
      setStatus('error')
      setErrorCode('NOT_CONFIGURED')
      return
    }
    if (Notification.permission === 'denied') {
      setStatus('blocked')
      return
    }

    setStatus('working')

    try {
      // Must stay the first awaited call: the prompt needs the user gesture.
      const permission =
        Notification.permission === 'default'
          ? await Notification.requestPermission()
          : Notification.permission

      if (permission === 'denied') {
        setStatus('blocked')
        return
      }
      if (permission !== 'granted') {
        setStatus('off')
        return
      }

      await subscribeThisDevice(userId)
      setStatus('on')
    } catch (error) {
      setErrorCode(errorCodeOf(error, 'SUBSCRIBE_FAILED'))
      setStatus('error')
    }
  }, [userId])

  const disable = useCallback(async () => {
    if (!userId) return

    setLastAction('disable')
    setErrorCode(null)
    setStatus('working')

    try {
      await unsubscribeThisDevice(userId)
      setStatus('off')
    } catch (error) {
      setErrorCode(errorCodeOf(error, 'REMOVE_FAILED'))
      setStatus('error')
    }
  }, [userId])

  const retry = useCallback(async () => {
    if (lastAction === 'enable') {
      await enable()
    } else {
      await disable()
    }
  }, [lastAction, enable, disable])

  return { status, errorCode, lastAction, enable, disable, retry, refresh }
}
