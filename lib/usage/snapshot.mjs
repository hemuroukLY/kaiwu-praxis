import { normalizeFeedbackByWorker } from './feedback.mjs'

function sortKeys(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const out = {}
  for (const key of Object.keys(value).sort()) out[key] = sortKeys(value[key])
  return out
}

function stableJson(value) {
  return JSON.stringify(sortKeys(value))
}

/** 终端用量快照是否等价（决定是否写 settings）。 */
export function usageSnapshotsEqual(left = {}, right = {}) {
  return Number(left.sessionCount) === Number(right.sessionCount)
    && stableJson(left.sessionsByWorker || {}) === stableJson(right.sessionsByWorker || {})
    && stableJson(normalizeFeedbackByWorker(left.feedbackByWorker)) === stableJson(normalizeFeedbackByWorker(right.feedbackByWorker))
}
