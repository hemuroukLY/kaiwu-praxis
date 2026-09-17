/**
 * kaiwu-praxis / admin.mjs
 * Host 数据层入口：settings 命名空间、能力播种物化、企业终端心跳。
 * 实现拆在 lib/admin/*；本文件保持对外 import 路径稳定。
 */

import { mkdir } from 'node:fs/promises'
import { DEFAULT_HUB_URL } from './enterprise-endpoint.mjs'
import { NS, WORKER_IDS } from './admin/constants.mjs'
import { AdminSchema } from './admin/schema.mjs'
import {
  defaultProfileFor,
  mergeProfile,
} from './admin/profile.mjs'
import {
  materialize,
  mergeSkills,
  mergeTools,
  seededWorkers,
  tempWorkspaceDir,
} from './admin/materialize.mjs'
import { startEnterpriseTerminalSync } from './admin/terminal-sync.mjs'

export const name = 'kaiwu-praxis-admin'
export {
  collectFeedbackByWorker,
  decideFeedbackPublish,
  decideFeedbackUpdate,
  employeeDashboardMetrics,
  foldMessageFeedbackItems,
  itemsFromMessageFeedbackResult,
  kaiwuSessionsFromHost,
  normalizeFeedbackByWorker,
  refreshTerminalUsage,
  resolveHubFeedbackJson,
  usageSnapshotsEqual,
} from './usage/index.mjs'

export {
  capabilitySummary,
  defaultProfileFor,
  extractPersonaText,
  growthTimeline,
  mergeProfile,
  renderIdentityPersona,
  replacePersonaText,
} from './admin/profile.mjs'

export { materializedDocFileName } from './admin/materialize.mjs'
export { applyEnterpriseCommand } from './admin/enterprise-commands.mjs'

export function apply(ctx, config = {}) {
  // sessions / messageFeedback 必须 inject，Cordis 禁止软读 ctx.sessions。
  ctx.inject(['settings', 'sessions', 'messageFeedback'], (sctx) => {
    const scope = sctx.settings.register(NS, AdminSchema, { base: { workers: {} } })
    const logger = sctx.logger ?? ctx.logger

    scope.watch((next) => {
      materialize(next && next.workers ? next.workers : {}).catch((e) => {
        logger?.warn(`kaiwu-praxis: materialize failed: ${(e && e.message) || e}`)
      })
    })

    const tempDir = tempWorkspaceDir()
    const current = scope.get()
    const seeded = seededWorkers()
    const merged = {}
    for (const id of WORKER_IDS) {
      const cur = (current && current.workers && current.workers[id]) || {}
      merged[id] = {
        profile: mergeProfile(seeded[id].profile, cur.profile || {}),
        knowledge: cur.knowledge || [],
        memories: cur.memories || [],
        sops: cur.sops || [],
        tasks: cur.tasks || [],
        skills: mergeSkills(seeded[id].skills, cur.skills || []),
        tools: mergeTools(seeded[id].tools, cur.tools || []),
      }
    }
    mkdir(tempDir, { recursive: true }).catch((e) => {
      logger?.warn(`kaiwu-praxis: mkdir temp workspace failed: ${(e && e.message) || e}`)
    })
    const enterprise = {
      hubUrl: current?.enterprise?.hubUrl || process.env.KAIWU_ENTERPRISE_HUB_URL || DEFAULT_HUB_URL,
      enrollmentCode: current?.enterprise?.enrollmentCode || process.env.KAIWU_ENTERPRISE_ENROLLMENT_CODE || '',
      terminalName: current?.enterprise?.terminalName || '',
      status: current?.enterprise?.status || '未注册',
      terminalId: current?.enterprise?.terminalId || '',
      enterpriseName: current?.enterprise?.enterpriseName || '',
      lastConnectedAt: current?.enterprise?.lastConnectedAt || '',
      lastError: current?.enterprise?.lastError || '',
      sessionCount: Number(current?.enterprise?.sessionCount) || 0,
      sessionsByWorker: current?.enterprise?.sessionsByWorker || {},
      feedbackByWorker: current?.enterprise?.feedbackByWorker || {},
    }
    const nextValue = { workers: merged, tempWorkspacePath: tempDir, enterprise }
    const changed = JSON.stringify(merged) !== JSON.stringify((current && current.workers) || {}) ||
      (current && current.tempWorkspacePath) !== tempDir ||
      JSON.stringify(enterprise) !== JSON.stringify(current?.enterprise || {})
    if (changed) {
      scope.update(nextValue).catch((e) => {
        logger?.warn(`kaiwu-praxis: sync admin settings failed: ${(e && e.message) || e}`)
      })
    } else {
      materialize(current.workers).catch((e) => {
        logger?.warn(`kaiwu-praxis: initial materialize failed: ${(e && e.message) || e}`)
      })
    }

    startEnterpriseTerminalSync({
      scope,
      sessions: sctx.sessions,
      messageFeedback: sctx.messageFeedback,
      logger,
      effect: sctx.effect?.bind(sctx),
    })
  })
}
