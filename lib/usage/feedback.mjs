/**
 * 反馈桶：归一化、折叠、求和、并发采集。
 * 契约仅 camelCase（totalFeedback / upCount / downCount）。
 */

import { FEEDBACK_CONCURRENCY, FEEDBACK_SESSION_CAP } from './constants.mjs'

export function emptyFeedbackBucket() {
  return { totalFeedback: 0, upCount: 0, downCount: 0 }
}

/** 非法输入 → 空桶；up+down > total 时以 up+down 重算 total。 */
export function normalizeFeedbackBucket(raw = null) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyFeedbackBucket()
  let totalFeedback = Math.max(0, Number(raw.totalFeedback) || 0)
  const upCount = Math.max(0, Number(raw.upCount) || 0)
  const downCount = Math.max(0, Number(raw.downCount) || 0)
  if (upCount + downCount > totalFeedback) totalFeedback = upCount + downCount
  return { totalFeedback, upCount, downCount }
}

export function normalizeFeedbackByWorker(raw = null) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const next = {}
  for (const [workerId, bucket] of Object.entries(raw)) {
    const id = String(workerId || '').trim()
    if (!id) continue
    next[id] = normalizeFeedbackBucket(bucket)
  }
  return next
}

/** 把 messageFeedback items（positive | negative）折进按员工分桶。 */
export function foldMessageFeedbackItems(feedbackByWorker = {}, workerId, items = []) {
  const id = String(workerId || '').trim()
  if (!id) return normalizeFeedbackByWorker(feedbackByWorker)
  const next = normalizeFeedbackByWorker(feedbackByWorker)
  const bucket = { ...normalizeFeedbackBucket(next[id]) }
  for (const item of items || []) {
    const rating = item?.rating
    if (rating !== 'positive' && rating !== 'negative') continue
    bucket.totalFeedback += 1
    if (rating === 'positive') bucket.upCount += 1
    else bucket.downCount += 1
  }
  next[id] = bucket
  return next
}

export function sumFeedbackBuckets(buckets = []) {
  const acc = emptyFeedbackBucket()
  for (const raw of buckets) {
    const bucket = normalizeFeedbackBucket(raw)
    acc.totalFeedback += bucket.totalFeedback
    acc.upCount += bucket.upCount
    acc.downCount += bucket.downCount
  }
  return acc
}

/**
 * Host messageFeedback.list 结果 → items | [] | null。
 * null = 基础设施/未知失败，整批应中止。
 */
export function itemsFromMessageFeedbackResult(result) {
  if (!result || typeof result !== 'object') return null
  if (result.ok === false) {
    if (result.error?.code === 'session-not-found') return []
    return null
  }
  if (result.ok === true) return Array.isArray(result.value?.items) ? result.value.items : []
  return null
}

/**
 * 有限并发拉取反馈，再串行折桶。
 * @returns {object|null} 汇总；null = 中途失败，调用方应保留旧值且不要上报。
 */
export async function collectFeedbackByWorker(rows, listItems, {
  concurrency = FEEDBACK_CONCURRENCY,
  sessionCap = FEEDBACK_SESSION_CAP,
} = {}) {
  const capped = Array.isArray(rows) ? rows.slice(0, sessionCap) : []
  if (!capped.length) return {}
  if (typeof listItems !== 'function') return null

  const results = new Array(capped.length)
  let index = 0
  let aborted = false

  async function worker() {
    while (!aborted) {
      const current = index
      index += 1
      if (current >= capped.length) return
      const items = await listItems(capped[current].id)
      if (items === null) {
        aborted = true
        return
      }
      results[current] = items
    }
  }

  await Promise.all(Array.from(
    { length: Math.min(concurrency, capped.length) },
    () => worker(),
  ))
  if (aborted) return null

  let acc = {}
  for (let i = 0; i < capped.length; i++) {
    acc = foldMessageFeedbackItems(acc, capped[i].workerId, results[i] || [])
  }
  return acc
}
