/**
 * 终端用量管道：采集 → 归一 → 发布决策 →（可选）写入 settings。
 *
 * 扩展下一类指标时：新增 collector + 写入 snapshot 字段 + publish policy，
 * 勿在 admin.mjs / client.js 再贴平行逻辑。
 */

import { collectFeedbackByWorker, itemsFromMessageFeedbackResult } from './feedback.mjs'
import { decideFeedbackPublish } from './publish-policy.mjs'
import { kaiwuSessionsFromHost } from './sessions.mjs'
import { usageSnapshotsEqual } from './snapshot.mjs'

/**
 * @param {{
 *   listSessions: () => any[],
 *   listMessageFeedback?: (sessionId: string) => Promise<any>,
 *   previous: { sessionCount?: number, sessionsByWorker?: object, feedbackByWorker?: object },
 *   onWarn?: (message: string) => void,
 * }} deps
 * @returns {Promise<{
 *   snapshot: { sessionCount: number, sessionsByWorker: object, feedbackByWorker: object },
 *   shouldPublishFeedback: boolean,
 *   changed: boolean,
 *   sessionsAvailable: boolean,
 * }>}
 */
export async function refreshTerminalUsage({
  listSessions,
  listMessageFeedback,
  previous = {},
  onWarn,
} = {}) {
  if (typeof listSessions !== 'function') {
    return {
      snapshot: {
        sessionCount: Number(previous.sessionCount) || 0,
        sessionsByWorker: previous.sessionsByWorker || {},
        feedbackByWorker: previous.feedbackByWorker || {},
      },
      shouldPublishFeedback: false,
      changed: false,
      sessionsAvailable: false,
    }
  }

  const allSessions = listSessions() || []
  const { sessionCount, sessionsByWorker, rows } = kaiwuSessionsFromHost(allSessions)

  let collected
  if (typeof listMessageFeedback === 'function' && rows.length > 0) {
    try {
      collected = await collectFeedbackByWorker(rows, async (sessionId) => {
        try {
          return itemsFromMessageFeedbackResult(await listMessageFeedback(sessionId))
        } catch (error) {
          onWarn?.(`messageFeedback.list failed: ${(error && error.message) || error}`)
          return null
        }
      })
    } catch (error) {
      onWarn?.(`feedback aggregate failed: ${(error && error.message) || error}`)
      collected = null
    }
  }

  const { feedbackByWorker, shouldPublishFeedback } = decideFeedbackPublish({
    allSessionCount: allSessions.length,
    kaiwuRows: rows,
    previousFeedbackByWorker: previous.feedbackByWorker,
    collected,
  })

  const snapshot = { sessionCount, sessionsByWorker, feedbackByWorker }
  return {
    snapshot,
    shouldPublishFeedback,
    changed: !usageSnapshotsEqual(previous, snapshot),
    sessionsAvailable: true,
  }
}
