/**
 * 企业指令应用到本地 workers，以及心跳上报用的终端快照。
 */
import {
  LOCAL_SOURCE,
  WORKER_IDS,
} from './constants.mjs'
import { defaultProfileFor, mergeProfile } from './profile.mjs'
import { sanitizeName } from './materialize.mjs'

export function terminalWorkerSnapshot(workers) {
  const result = {}
  for (const id of WORKER_IDS) {
    const worker = workers[id] || {}
    result[id] = {
      profile: worker.profile || {},
      knowledge: (worker.knowledge || []).map((item) => ({ name: item.name })),
      sops: (worker.sops || []).map((item) => ({ name: item.name })),
      skills: (worker.skills || []).map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        source: item.source,
        packageVersion: item.packageVersion,
        enabled: item.enabled !== false,
        deleted: item.deleted === true,
      })),
      tools: (worker.tools || []).map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        source: item.source,
        packageVersion: item.packageVersion,
        enabled: item.enabled !== false,
      })),
    }
  }
  return result
}

export function applyEnterpriseCommand(workers, command) {
  const next = structuredClone(workers || {})
  const payload = command.payload || {}
  for (const workerId of command.workerIds || []) {
    const worker = next[workerId]
    if (!worker) continue
    if (payload.action === 'addKnowledge') {
      worker.knowledge = [...(worker.knowledge || []), { name: payload.name, content: payload.content || '' }]
    } else if (payload.action === 'removeKnowledge') {
      worker.knowledge = (worker.knowledge || []).filter((item) => item.name !== payload.name)
    } else if (payload.action === 'addSop') {
      worker.sops = [...(worker.sops || []), { name: payload.name, content: payload.content || '' }]
    } else if (payload.action === 'removeSop') {
      worker.sops = (worker.sops || []).filter((item) => item.name !== payload.name)
    } else if (payload.action === 'addSkill') {
      worker.skills = [...(worker.skills || []), {
        id: `enterprise-${sanitizeName(payload.name)}-${Date.now()}`,
        name: payload.name,
        description: payload.description || '',
        content: payload.content || '',
        enabled: true,
        deleted: false,
        source: LOCAL_SOURCE,
        baseVersion: '',
        packageVersion: '',
        localRevision: 1,
        modified: true,
      }]
    } else if (payload.action === 'removeSkill') {
      worker.skills = (worker.skills || []).flatMap((skill) => {
        if ((skill.id || skill.name) !== payload.name && skill.name !== payload.name) return [skill]
        if (skill.source === LOCAL_SOURCE) return []
        return [{ ...skill, enabled: false, deleted: true, localRevision: (Number(skill.localRevision) || 0) + 1 }]
      })
    } else if (payload.action === 'enableTool' || payload.action === 'disableTool') {
      worker.tools = (worker.tools || []).map((tool) => {
        if ((tool.id || tool.name) !== payload.name && tool.name !== payload.name) return tool
        const enabled = payload.action === 'enableTool'
        return { ...tool, enabled, modified: !enabled, localRevision: (Number(tool.localRevision) || 0) + 1 }
      })
    } else if (payload.action === 'updateProfile') {
      worker.profile = mergeProfile(defaultProfileFor(workerId), payload.profile || {})
    }
  }
  return next
}

