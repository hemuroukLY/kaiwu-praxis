/**
 * 档案页展示指标：对话次数 + 反馈汇总 → 次数/好评率/差评率。
 * 对话次数须来自 Host 写入的 sessionsByWorker（或中枢同源字段），勿混用浏览器会话表。
 */

import { normalizeFeedbackBucket } from './feedback.mjs'

/**
 * @param {number|Array} sessions 对话次数，或会话数组（length 作为次数，兼容旧调用）
 * @param {object|null} feedback 反馈桶
 */
export function employeeDashboardMetrics(sessions = [], feedback = null) {
  const bucket = normalizeFeedbackBucket(feedback)
  const feedbackCount = bucket.totalFeedback
  const conversationCount = Array.isArray(sessions)
    ? sessions.length
    : Math.max(0, Number(sessions) || 0)
  return {
    conversationCount,
    feedbackCount,
    positiveRate: feedbackCount ? Math.round((bucket.upCount / feedbackCount) * 100) : 0,
    negativeRate: feedbackCount ? Math.round((bucket.downCount / feedbackCount) * 100) : 0,
  }
}
