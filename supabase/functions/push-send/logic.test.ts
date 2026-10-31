import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildPayload,
  deliver,
  isGoneStatus,
  secureCompare,
  statusFromError,
  validateRequest,
  type PushSubscriptionRow,
} from './logic.ts'

const USER_ID = '3f1c2a9e-8b7d-4c6e-9a1f-2d3e4f5a6b7c'
const RUN_ID = '9b2f7c14-5d3e-4a61-8c02-7e5d1f3a9b40'

const subscription = (id: string): PushSubscriptionRow => ({
  id,
  endpoint: `https://push.example.test/${id}`,
  p256dh: 'p256dh-key',
  auth: 'auth-secret',
})

test('validateRequest accepts a valid analysis notification', () => {
  const result = validateRequest({
    user_id: USER_ID,
    kind: 'analysis_succeeded',
    url: `/analyse/${RUN_ID}`,
  })

  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.deepEqual(result.value, {
    userId: USER_ID,
    kind: 'analysis_succeeded',
    runId: RUN_ID,
  })
})

test('validateRequest rejects an unknown kind', () => {
  const result = validateRequest({
    user_id: USER_ID,
    kind: 'analysis_started',
    url: `/analyse/${RUN_ID}`,
  })

  assert.deepEqual(result, { ok: false, code: 'VALIDATION' })
})

test('validateRequest rejects an absolute URL', () => {
  const result = validateRequest({
    user_id: USER_ID,
    kind: 'analysis_failed',
    url: `https://evil.example/analyse/${RUN_ID}`,
  })

  assert.deepEqual(result, { ok: false, code: 'VALIDATION' })
})

test('validateRequest rejects a path that does not match the kind', () => {
  const result = validateRequest({
    user_id: USER_ID,
    kind: 'analysis_failed',
    url: `/assistants/${RUN_ID}`,
  })

  assert.deepEqual(result, { ok: false, code: 'VALIDATION' })
})

test('validateRequest rejects an invalid user id', () => {
  const result = validateRequest({
    user_id: 'not-a-uuid',
    kind: 'analysis_failed',
    url: `/analyse/${RUN_ID}`,
  })

  assert.deepEqual(result, { ok: false, code: 'VALIDATION' })
})

test('validateRequest rejects a missing body', () => {
  assert.deepEqual(validateRequest(null), { ok: false, code: 'VALIDATION' })
})

test('buildPayload contains exactly kind and run_id', () => {
  const payload = JSON.parse(buildPayload('analysis_succeeded', RUN_ID))

  assert.deepEqual(Object.keys(payload).sort(), ['kind', 'run_id'])
  assert.equal(payload.kind, 'analysis_succeeded')
  assert.equal(payload.run_id, RUN_ID)
})

test('isGoneStatus treats 404 and 410 as expired', () => {
  assert.equal(isGoneStatus(404), true)
  assert.equal(isGoneStatus(410), true)
  assert.equal(isGoneStatus(400), false)
  assert.equal(isGoneStatus(500), false)
})

test('statusFromError reads the push service response status', () => {
  assert.equal(statusFromError({ response: { status: 410 } }), 410)
  assert.equal(statusFromError(new Error('boom')), null)
  assert.equal(statusFromError(null), null)
})

test('deliver counts successful sends', async () => {
  const counts = await deliver(
    [subscription('a'), subscription('b')],
    async () => {},
    {
      onGone: async () => {},
      onError: () => {},
    },
  )

  assert.deepEqual(counts, { sent: 2, removed: 0, failed: 0 })
})

test('deliver removes a subscription the push service reports as gone', async () => {
  const removed: string[] = []

  const counts = await deliver(
    [subscription('a'), subscription('b')],
    async (row) => {
      if (row.id === 'a') throw { response: { status: 410 } }
    },
    {
      onGone: async (id) => {
        removed.push(id)
      },
      onError: () => {},
    },
  )

  assert.deepEqual(counts, { sent: 1, removed: 1, failed: 0 })
  assert.deepEqual(removed, ['a'])
})

test('deliver keeps a subscription on a non-gone failure and never throws', async () => {
  const failed: Array<{ subscriptionId: string; status: number | null }> = []

  const counts = await deliver(
    [subscription('a')],
    async () => {
      throw { response: { status: 503 } }
    },
    {
      onGone: async () => {
        assert.fail('onGone must not run for a 503')
      },
      onError: (info) => failed.push(info),
    },
  )

  assert.deepEqual(counts, { sent: 0, removed: 0, failed: 1 })
  assert.deepEqual(failed, [{ subscriptionId: 'a', status: 503 }])
})

test('deliver does not log or expose the endpoint on failure', async () => {
  const failed: Array<{ subscriptionId: string; status: number | null }> = []

  await deliver(
    [subscription('a')],
    async () => {
      throw new Error('network down')
    },
    {
      onGone: async () => {},
      onError: (info) => failed.push(info),
    },
  )

  assert.deepEqual(Object.keys(failed[0]!).sort(), ['status', 'subscriptionId'])
  assert.equal(JSON.stringify(failed).includes('push.example.test'), false)
})

test('deliver counts a failed cleanup as failed', async () => {
  const counts = await deliver(
    [subscription('a')],
    async () => {
      throw { response: { status: 404 } }
    },
    {
      onGone: async () => {
        throw new Error('delete failed')
      },
      onError: () => {},
    },
  )

  assert.deepEqual(counts, { sent: 0, removed: 0, failed: 1 })
})

test('secureCompare only matches identical non-empty tokens', () => {
  assert.equal(secureCompare('token', 'token'), true)
  assert.equal(secureCompare('token', 'toKen'), false)
  assert.equal(secureCompare('token', 'token-longer'), false)
  assert.equal(secureCompare('', ''), false)
})
