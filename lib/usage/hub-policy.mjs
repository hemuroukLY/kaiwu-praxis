/**
 * 中枢 feedback_json 落库策略。
 * - 省略字段 → 保留旧值
 * - 空桶 + 零会话 → 不覆盖非空旧值（防冷启动抹数）
 */

import { normalizeFeedbackByWorker } from './feedback.mjs'

function safeParseObject(text) {
  try {
    const value = JSON.parse(text)
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  } catch {
    return {}
  }
}

/**
 * @returns {string} 写入 feedback_json 的 JSON 文本
 */
export function resolveHubFeedbackJson(previousJson, incoming, sessionCount = 0) {
  const previousText = typeof previousJson === 'string' && previousJson ? previousJson : '{}'
  if (incoming === undefined) return previousText

  const next = normalizeFeedbackByWorker(incoming)
  const prev = normalizeFeedbackByWorker(safeParseObject(previousText))
  const nextEmpty = Object.keys(next).length === 0
  const prevEmpty = Object.keys(prev).length === 0
  if (nextEmpty && !prevEmpty && !(Number(sessionCount) > 0)) return previousText
  return JSON.stringify(next)
}
