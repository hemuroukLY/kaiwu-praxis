/**
 * 企业终端心跳：刷新用量 → 上报中枢 → 领取并执行指令。
 */
import { DEFAULT_HUB_URL, syncEnterpriseTerminal } from '../enterprise-endpoint.mjs'
import { refreshTerminalUsage } from '../usage/index.mjs'
import { applyEnterpriseCommand, terminalWorkerSnapshot } from './enterprise-commands.mjs'
import { dshHome } from './materialize.mjs'

/**
 * @param {{
 *   scope: { get: Function, update: Function },
 *   sessions: any,
 *   messageFeedback: any,
 *   logger?: { warn?: Function },
 *   effect?: Function,
 * }} deps
 */
export function startEnterpriseTerminalSync({ scope, sessions, messageFeedback, logger, effect }) {
  let syncing = false
  let lastPublished = ''

  async function publishConnection(patch) {
    const value = scope.get() || {}
    const currentEnterprise = value.enterprise || {}
    const nextEnterprise = { ...currentEnterprise, ...patch }
    if (patch.status === '已连接' && currentEnterprise.status === '已连接' && Date.now() - Date.parse(currentEnterprise.lastConnectedAt || 0) < 30000) {
      nextEnterprise.lastConnectedAt = currentEnterprise.lastConnectedAt
    }
    if (patch.clearEnrollmentCode) nextEnterprise.enrollmentCode = ''
    delete nextEnterprise.clearEnrollmentCode
    const serialized = JSON.stringify(nextEnterprise)
    if (serialized === JSON.stringify(currentEnterprise) || serialized === lastPublished) return
    lastPublished = serialized
    await scope.update({ ...value, enterprise: nextEnterprise })
  }

  async function refreshUsageIntoSettings() {
    const value = scope.get() || {}
    const enterprise = value.enterprise || {}
    const { snapshot, shouldPublishFeedback, changed, sessionsAvailable } = await refreshTerminalUsage({
      listSessions: sessions && typeof sessions.list === 'function' ? () => sessions.list() : null,
      listMessageFeedback: messageFeedback && typeof messageFeedback.list === 'function'
        ? (sessionId) => messageFeedback.list({ sessionId })
        : undefined,
      previous: enterprise,
      onWarn: (message) => logger?.warn(`kaiwu-praxis: ${message}`),
    })
    if (!sessionsAvailable) {
      return { enterprise, shouldPublishFeedback: false }
    }
    const nextEnterprise = { ...enterprise, ...snapshot }
    if (changed) {
      await scope.update({ ...value, enterprise: nextEnterprise })
    }
    return { enterprise: nextEnterprise, shouldPublishFeedback }
  }

  async function reportAndPull() {
    if (syncing) return
    syncing = true
    try {
      const { enterprise, shouldPublishFeedback } = await refreshUsageIntoSettings()
      const value = scope.get() || {}
      const response = await syncEnterpriseTerminal({
        dshHome: dshHome(),
        enterprise,
        workers: terminalWorkerSnapshot(value.workers || {}),
        sessionCount: Number(enterprise.sessionCount) || 0,
        sessionsByWorker: enterprise.sessionsByWorker || {},
        feedbackByWorker: shouldPublishFeedback ? (enterprise.feedbackByWorker || {}) : undefined,
        executeCommand: async (command) => {
          const currentValue = scope.get() || {}
          const nextWorkers = applyEnterpriseCommand(currentValue.workers || {}, command)
          await scope.update({ ...currentValue, workers: nextWorkers })
        },
      })
      await publishConnection(response)
    } catch (error) {
      await publishConnection({ status: '连接失败', lastError: error.message || String(error) }).catch(() => {})
    } finally {
      syncing = false
    }
  }

  const timer = setInterval(reportAndPull, 3000)
  timer.unref?.()
  setTimeout(reportAndPull, 400).unref?.()
  effect?.(() => () => clearInterval(timer), 'kaiwu-praxis: enterprise terminal sync')
}

export { DEFAULT_HUB_URL }
