/**
 * usage 管道纯函数单测（含发布/中枢落库策略）。
 */
import assert from 'node:assert/strict'
import {
  collectFeedbackByWorker,
  decideFeedbackPublish,
  decideFeedbackUpdate,
  employeeDashboardMetrics,
  foldMessageFeedbackItems,
  itemsFromMessageFeedbackResult,
  kaiwuSessionsFromHost,
  normalizeFeedbackBucket,
  normalizeFeedbackByWorker,
  refreshTerminalUsage,
  resolveHubFeedbackJson,
  sumFeedbackBuckets,
  usageSnapshotsEqual,
} from '../lib/usage/index.mjs'

assert.deepEqual(normalizeFeedbackBucket({ totalFeedback: 2, upCount: 1, downCount: 1, extra: 9 }), {
  totalFeedback: 2,
  upCount: 1,
  downCount: 1,
})
assert.deepEqual(normalizeFeedbackBucket({ total_feedback: 4, up_count: 3 }), {
  totalFeedback: 0,
  upCount: 0,
  downCount: 0,
}, 'snake_case 不再认，避免双契约')
assert.deepEqual(normalizeFeedbackBucket({ totalFeedback: 2, upCount: 2, downCount: 2 }), {
  totalFeedback: 4, upCount: 2, downCount: 2,
}, 'inconsistent up/down recomputes total')

assert.deepEqual(
  foldMessageFeedbackItems({}, 'kaiwu-watermark', [
    { rating: 'positive' },
    { rating: 'negative' },
    { rating: 'meh' },
  ]),
  { 'kaiwu-watermark': { totalFeedback: 2, upCount: 1, downCount: 1 } },
)

assert.deepEqual(
  employeeDashboardMetrics([{ id: 'a' }, { id: 'b' }], { totalFeedback: 4, upCount: 3, downCount: 1 }),
  { conversationCount: 2, feedbackCount: 4, positiveRate: 75, negativeRate: 25 },
)
assert.deepEqual(
  employeeDashboardMetrics(2, { totalFeedback: 4, upCount: 3, downCount: 1 }),
  { conversationCount: 2, feedbackCount: 4, positiveRate: 75, negativeRate: 25 },
  'numeric conversationCount (Host sessionsByWorker) is preferred API',
)

assert.deepEqual(
  sumFeedbackBuckets([
    { totalFeedback: 2, upCount: 2, downCount: 0 },
    { totalFeedback: 2, upCount: 1, downCount: 1 },
  ]),
  { totalFeedback: 4, upCount: 3, downCount: 1 },
)

assert.equal(
  usageSnapshotsEqual(
    { sessionCount: 1, sessionsByWorker: { a: 1 }, feedbackByWorker: { a: { totalFeedback: 1, upCount: 1, downCount: 0 } } },
    { sessionCount: 1, sessionsByWorker: { a: 1 }, feedbackByWorker: { a: { totalFeedback: 1, upCount: 1, downCount: 0 } } },
  ),
  true,
)

assert.deepEqual(itemsFromMessageFeedbackResult({ ok: true, value: { items: [{ rating: 'positive' }] } }), [{ rating: 'positive' }])
assert.deepEqual(itemsFromMessageFeedbackResult({ ok: false, error: { code: 'session-not-found' } }), [])
assert.equal(itemsFromMessageFeedbackResult({ ok: false, error: { code: 'other' } }), null)

const host = kaiwuSessionsFromHost([
  { id: 's1', seq: 3, header: { agentPreset: 'kaiwu-watermark' } },
  { id: 's2', seq: 0, header: { agentPreset: 'kaiwu-watermark' } },
  { id: 's3', seq: 1, header: { agentPreset: 'other' } },
])
assert.equal(host.sessionCount, 1)
assert.deepEqual(host.sessionsByWorker, { 'kaiwu-watermark': 1 })
assert.deepEqual(host.rows, [{ id: 's1', workerId: 'kaiwu-watermark' }])

const collected = await collectFeedbackByWorker(
  [
    { id: 's1', workerId: 'kaiwu-watermark' },
    { id: 's2', workerId: 'kaiwu-watermark' },
  ],
  async (sessionId) => (sessionId === 's1' ? [{ rating: 'positive' }] : [{ rating: 'negative' }]),
  { concurrency: 2 },
)
assert.deepEqual(collected, { 'kaiwu-watermark': { totalFeedback: 2, upCount: 1, downCount: 1 } })

assert.equal(await collectFeedbackByWorker([{ id: 's1', workerId: 'kaiwu-watermark' }], async () => null), null)

assert.deepEqual(normalizeFeedbackByWorker({ ' kaiwu-x ': { totalFeedback: 1, upCount: 1, downCount: 0 } }), {
  'kaiwu-x': { totalFeedback: 1, upCount: 1, downCount: 0 },
})

const prev = { 'kaiwu-watermark': { totalFeedback: 4, upCount: 3, downCount: 1 } }
assert.deepEqual(
  decideFeedbackPublish({ allSessionCount: 0, kaiwuRows: [], previousFeedbackByWorker: prev, collected: undefined }),
  { feedbackByWorker: prev, shouldPublishFeedback: false },
  'empty store keeps previous and does not publish',
)
assert.deepEqual(
  decideFeedbackPublish({ allSessionCount: 2, kaiwuRows: [], previousFeedbackByWorker: prev, collected: undefined }),
  { feedbackByWorker: {}, shouldPublishFeedback: true },
  'non-kaiwu sessions clear kaiwu feedback',
)
assert.deepEqual(
  decideFeedbackPublish({
    allSessionCount: 1,
    kaiwuRows: [{ id: 's1', workerId: 'kaiwu-watermark' }],
    previousFeedbackByWorker: prev,
    collected: null,
  }),
  { feedbackByWorker: prev, shouldPublishFeedback: false },
  'collect failure keeps previous',
)
assert.deepEqual(
  decideFeedbackPublish({
    allSessionCount: 1,
    kaiwuRows: [{ id: 's1', workerId: 'kaiwu-watermark' }],
    previousFeedbackByWorker: prev,
    collected: { 'kaiwu-watermark': { totalFeedback: 1, upCount: 1, downCount: 0 } },
  }),
  { feedbackByWorker: { 'kaiwu-watermark': { totalFeedback: 1, upCount: 1, downCount: 0 } }, shouldPublishFeedback: true },
)

// 兼容别名
assert.deepEqual(
  decideFeedbackUpdate({ allSessionCount: 0, kaiwuRows: [], previousFeedbackByWorker: prev, collected: undefined }),
  { feedbackByWorker: prev, feedbackTouched: false },
)

assert.equal(
  resolveHubFeedbackJson(JSON.stringify(prev), undefined, 0),
  JSON.stringify(prev),
  'omit keeps previous json',
)
assert.equal(
  resolveHubFeedbackJson(JSON.stringify(prev), {}, 0),
  JSON.stringify(prev),
  'empty + zero sessions keeps previous',
)
assert.equal(
  resolveHubFeedbackJson(JSON.stringify(prev), {}, 2),
  '{}',
  'empty + positive sessions clears',
)
assert.equal(
  resolveHubFeedbackJson('{}', { 'kaiwu-watermark': { totalFeedback: 1, upCount: 1, downCount: 0 } }, 1),
  JSON.stringify({ 'kaiwu-watermark': { totalFeedback: 1, upCount: 1, downCount: 0 } }),
)

const pipeline = await refreshTerminalUsage({
  listSessions: () => [
    { id: 's1', seq: 2, header: { agentPreset: 'kaiwu-watermark' } },
  ],
  listMessageFeedback: async () => ({ ok: true, value: { items: [{ rating: 'positive' }] } }),
  previous: { sessionCount: 0, sessionsByWorker: {}, feedbackByWorker: {} },
})
assert.equal(pipeline.sessionsAvailable, true)
assert.equal(pipeline.shouldPublishFeedback, true)
assert.equal(pipeline.snapshot.sessionCount, 1)
assert.deepEqual(pipeline.snapshot.feedbackByWorker, {
  'kaiwu-watermark': { totalFeedback: 1, upCount: 1, downCount: 0 },
})

const cold = await refreshTerminalUsage({
  listSessions: () => [],
  previous: { sessionCount: 0, sessionsByWorker: {}, feedbackByWorker: prev },
})
assert.equal(cold.shouldPublishFeedback, false)
assert.deepEqual(cold.snapshot.feedbackByWorker, prev)

console.log('test-usage-metrics: ok')
