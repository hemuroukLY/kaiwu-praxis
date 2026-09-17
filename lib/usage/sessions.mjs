/**
 * Host 会话 → 开物用量快照（对话次数唯一真相源）。
 */

import { EMPTY_TRANSCRIPT_SEQ, KAIWU_WORKER_ID_PREFIX } from './constants.mjs'

/**
 * Host Session → kaiwu 会话清单。
 * 跳过空 transcript（seq === EMPTY_TRANSCRIPT_SEQ）。
 */
export function kaiwuSessionsFromHost(sessionsList = []) {
  const byWorker = {}
  const rows = []
  let total = 0
  for (const session of sessionsList || []) {
    const workerId = session?.header?.agentPreset
    if (!workerId || !String(workerId).startsWith(KAIWU_WORKER_ID_PREFIX)) continue
    if (Number(session.seq) === EMPTY_TRANSCRIPT_SEQ) continue
    total += 1
    byWorker[workerId] = (byWorker[workerId] || 0) + 1
    rows.push({ id: session.id, workerId })
  }
  return { sessionCount: total, sessionsByWorker: byWorker, rows }
}

/** 某员工在终端快照中的对话次数（与中枢 sessionsByWorker 同口径）。 */
export function conversationCountForWorker(sessionsByWorker = {}, workerId = '') {
  const id = String(workerId || '').trim()
  if (!id) return 0
  return Math.max(0, Number(sessionsByWorker?.[id]) || 0)
}
