// Browser-side stubs for the Web Push API in Playwright (feature 018).
//
// Real push delivery cannot be tested: it needs a push service and a real
// browser profile, and headless Chromium often refuses PushManager.subscribe().
// These stubs make the UI state machine and the push_subscriptions round-trip
// deterministic; the send function has its own Node unit tests
// (research.md R8).

export function makeStubEndpoint(): string {
  return `https://push.example.test/darwin-e2e-${crypto.randomUUID()}`
}

export function installPushStub(endpointArg?: string) {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) return

  // A unique endpoint per test keeps the suite order-independent: a row left by
  // an earlier test can never make the next test start in the "on" state. The
  // value is passed in by addInitScript, so it survives a reload in one test.
  const endpoint = endpointArg ?? 'https://push.example.test/darwin-e2e-device'

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

  // Headless Chromium reports `Notification.permission === 'denied'` even when
  // Playwright granted it (navigator.permissions.query says 'granted'). Stub the
  // permission surface so the UI state machine is exercised; `stubDeniedPermission`
  // overrides this again for the blocked case.
  if (typeof Notification !== 'undefined') {
    Object.defineProperty(Notification, 'permission', {
      configurable: true,
      get: () => 'granted',
    })
    Object.defineProperty(Notification, 'requestPermission', {
      configurable: true,
      value: async () => 'granted',
    })
  }
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
