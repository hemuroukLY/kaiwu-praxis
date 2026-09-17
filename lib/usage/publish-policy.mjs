/**
 * 反馈是否写入本地 settings、是否随心跳上报中枢。
 *
 * 产品语义（勿再用 feedbackTouched 描述）：
 * - shouldPublishFeedback=true → 本轮心跳携带 feedbackByWorker
 * - shouldPublishFeedback=false → 省略字段，中枢保留旧值
 */

import { normalizeFeedbackByWorker } from './feedback.mjs'

/**
 * @param {{
 *   allSessionCount: number,
 *   kaiwuRows: Array<{ id: string, workerId: string }>,
 *   previousFeedbackByWorker: object,
 *   collected: object|null|undefined,
 * }} input
 *   collected: 已汇总对象；
 *   null = 采集失败 → 保留旧值且不上报；
 *   undefined = 本轮未扫描（无 kaiwu 行）
 * @returns {{ feedbackByWorker: object, shouldPublishFeedback: boolean }}
 */
export function decideFeedbackPublish({
  allSessionCount = 0,
  kaiwuRows = [],
  previousFeedbackByWorker = {},
  collected,
} = {}) {
  const previous = normalizeFeedbackByWorker(previousFeedbackByWorker)

  if (kaiwuRows.length > 0) {
    if (collected === null || collected === undefined) {
      return { feedbackByWorker: previous, shouldPublishFeedback: false }
    }
    return {
      feedbackByWorker: normalizeFeedbackByWorker(collected),
      shouldPublishFeedback: true,
    }
  }

  // 无开物会话：若 Host 仍有其它会话，视为该终端当前无开物员工会话 → 清空并上报。
  if (allSessionCount > 0) {
    return { feedbackByWorker: {}, shouldPublishFeedback: true }
  }

  // store 空：保留本地旧值且不上报，避免冷启动空桶抹中枢。
  return { feedbackByWorker: previous, shouldPublishFeedback: false }
}

/** @deprecated 使用 decideFeedbackPublish；保留别名供过渡。 */
export function decideFeedbackUpdate(input) {
  const { feedbackByWorker, shouldPublishFeedback } = decideFeedbackPublish(input)
  return { feedbackByWorker, feedbackTouched: shouldPublishFeedback }
}
