// Browser-side stubs for the Web Push API in Playwright (feature 018).
//
// Real push delivery cannot be tested: it needs a push service and a real
// browser profile, and headless Chromium often refuses PushManager.subscribe().
// These stubs make the UI state machine and the push_subscriptions round-trip
// deterministic; the send function has its own Node unit tests
// (research.md R8).

export function installPushStub() {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) return

  const endpoint = 'https://push.example.test/darwin-e2e-device'

  const makeSubscription = () => ({
    endpoint,
    expirationTime: null,
    options: { userVisibleOnly: true },
    getKey: () => new Uint8Array(65),
    toJSON: () => ({
      endpoint,
      expirationTime: null,
      keys: {
        p256dh: 'BNcE2eStubP256dhKeyForPlaywrightOnly',
        auth: 'e2e-stub-auth-secret',
      },
    }),
    unsubscribe: async () => true,
  })

  const pushManager = {
    getSubscription: async () => makeSubscription(),
    subscribe: async () => makeSubscription(),
    permissionState: async () => 'granted',
  }

  const registration = {
    pushManager,
    scope: '/',
    active: null,
    installing: null,
    waiting: null,
    update: async () => {},
    unregister: async () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
    showNotification: async () => {},
    getNotifications: async () => [],
  }

  // The app only uses the presence check and the registration object.
  Object.defineProperty(window, 'PushManager', {
    configurable: true,
    value: function StubPushManager() {},
  })
  Object.defineProperty(navigator.serviceWorker, 'register', {
    configurable: true,
    value: async () => registration,
  })
  Object.defineProperty(navigator.serviceWorker, 'getRegistration', {
    configurable: true,
    value: async () => registration,
  })
  Object.defineProperty(navigator.serviceWorker, 'ready', {
    configurable: true,
    get: () => Promise.resolve(registration),
  })
}

export function stubDeniedPermission() {
  if (typeof Notification === 'undefined') return
  Object.defineProperty(Notification, 'permission', {
    configurable: true,
    get: () => 'denied',
  })
}

export function stubUnsupportedPush() {
  Object.defineProperty(window, 'PushManager', {
    configurable: true,
    value: undefined,
  })
}
