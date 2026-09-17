/**
 * classic 展示公式 vs ESM dashboard/feedback 行为对齐。
 */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  conversationCountForWorker,
  employeeDashboardMetrics,
  emptyFeedbackBucket,
  normalizeFeedbackBucket,
  sumFeedbackBuckets,
} from '../lib/usage/index.mjs'

const require = createRequire(import.meta.url)
const classic = require(join(dirname(fileURLToPath(import.meta.url)), '../lib/usage/classic-display.cjs'))

const fixtures = [
  [0, null],
  [3, { totalFeedback: 4, upCount: 3, downCount: 1 }],
  [[{}, {}], { totalFeedback: 2, upCount: 2, downCount: 2 }],
  [5, { totalFeedback: 1, upCount: 0, downCount: 0 }],
  ['bad', { total_feedback: 9 }],
]

for (const [sessions, feedback] of fixtures) {
  assert.deepEqual(
    classic.employeeDashboardMetrics(sessions, feedback),
    employeeDashboardMetrics(sessions, feedback),
  )
  assert.deepEqual(
    classic.normalizeFeedbackBucket(feedback),
    normalizeFeedbackBucket(feedback),
  )
}

assert.deepEqual(classic.emptyFeedbackBucket(), emptyFeedbackBucket())
assert.deepEqual(
  classic.sumFeedbackBuckets([
    { totalFeedback: 2, upCount: 2, downCount: 0 },
    { totalFeedback: 2, upCount: 1, downCount: 1 },
  ]),
  sumFeedbackBuckets([
    { totalFeedback: 2, upCount: 2, downCount: 0 },
    { totalFeedback: 2, upCount: 1, downCount: 1 },
  ]),
)
assert.equal(
  classic.conversationCountForWorker({ 'kaiwu-watermark': 3 }, 'kaiwu-watermark'),
  conversationCountForWorker({ 'kaiwu-watermark': 3 }, 'kaiwu-watermark'),
)

console.log('check-usage-classic-parity: ok')
