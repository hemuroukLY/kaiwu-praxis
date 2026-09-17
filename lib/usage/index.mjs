/**
 * 用量 / 反馈管道对外入口（Host + 中枢）。
 *
 * 浏览器 classic client 不能 import ESM：展示公式见 classic-display.cjs，
 * 由 scripts/sync-usage-module.mjs 嵌入两端 client 的 USAGE_DISPLAY 标记区。
 */

export {
  FEEDBACK_CONCURRENCY,
  FEEDBACK_SESSION_CAP,
  EMPTY_TRANSCRIPT_SEQ,
  KAIWU_WORKER_ID_PREFIX,
} from './constants.mjs'

export {
  emptyFeedbackBucket,
  normalizeFeedbackBucket,
  normalizeFeedbackByWorker,
  foldMessageFeedbackItems,
  sumFeedbackBuckets,
  itemsFromMessageFeedbackResult,
  collectFeedbackByWorker,
} from './feedback.mjs'

export {
  kaiwuSessionsFromHost,
  conversationCountForWorker,
} from './sessions.mjs'

export { employeeDashboardMetrics } from './dashboard.mjs'
export { usageSnapshotsEqual } from './snapshot.mjs'

export {
  decideFeedbackPublish,
  decideFeedbackUpdate,
} from './publish-policy.mjs'

export { resolveHubFeedbackJson } from './hub-policy.mjs'
export { refreshTerminalUsage } from './pipeline.mjs'
