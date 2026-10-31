// Darwin service worker — notifications only (feature 018).
//
// Contract: specs/018-push-notifications/contracts/push-payload.md
// The payload carries ONLY { kind, run_id }; never client content.
//
// Deliberately absent: a fetch handler, the Cache API, localStorage,
// sessionStorage and IndexedDB (constitution III). This worker shows a
// notification and opens the analysis page; nothing else.

const TITLES = {
  analysis_succeeded: 'Uw risico-analyse is gereed',
  analysis_failed: 'Uw risico-analyse is mislukt',
}

// Only /analyse/<uuid> is a valid target — never an absolute URL.
const ANALYSIS_PATH = /^\/analyse\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let payload = null
  try {
    payload = event.data ? event.data.json() : null
  } catch {
    payload = null
  }

  if (!payload || typeof payload !== 'object') return

  const title = TITLES[payload.kind]
  const runId = payload.run_id
  if (typeof title !== 'string' || typeof runId !== 'string') return

  const url = `/analyse/${runId}`
  if (!ANALYSIS_PATH.test(url)) return

  // tag = run id: a repeated callback replaces the notification instead of
  // stacking a second one (FR-019).
  event.waitUntil(
    self.registration.showNotification(title, {
      tag: runId,
      data: { url },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const data = event.notification.data
  const url = data && data.url
  if (typeof url !== 'string' || !ANALYSIS_PATH.test(url)) return

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })

      for (const client of clientList) {
        if (typeof client.navigate !== 'function') continue
        try {
          const navigated = await client.navigate(url)
          await (navigated || client).focus()
          return
        } catch {
          // Fall through to opening a new window.
        }
      }

      await self.clients.openWindow(url)
    })(),
  )
})
