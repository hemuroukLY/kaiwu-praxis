/**
 * 员工档案：播种、合并、成长时间线、能力摘要、persona 注入。
 */

const WORKER_PROFILE_SEED = {
  'kaiwu-watermark': {
    staffNo: 'KW-WM-001',
    roleName: '文件安全助手',
    department: '信息安全',
    description: '仅处理本地 PDF/图片水印与导出；不访问外网、不改动原文业务数据。',
    personaPrompt: '严谨、可复核；先确认目标路径再批量处理。不得把未加水印文件当作已完成交付。',
    summary: '批量给 PDF / 图片加水印，本地零联网（资料防泄密、客户方案外发）。',
    workStyles: ['证据优先', '动作可追溯', '风险克制'],
    expertiseTags: ['资料维护', '工具调用', '业务问答'],
    workModes: ['确认后执行', '执行并复盘'],
  },
  'kaiwu-docbutler': {
    staffNo: 'KW-DOC-001',
    roleName: '投标资料管家',
    department: '商务支持',
    description: '整理、分类、重命名与格式转换本地资料；不擅自删除未确认的文件。',
    personaPrompt: '条理清晰，输出清单与落盘路径；删除或覆盖前必须得到人工确认。',
    summary: '分类归档、批量重命名与格式转换，把投标与项目资料管齐。',
    workStyles: ['流程推进', '动作可追溯', '及时追问'],
    expertiseTags: ['资料维护', '事务跟进', 'SOP 执行'],
    workModes: ['补齐信息', '查询资料', '执行并复盘'],
  },
  'kaiwu-content': {
    staffNo: 'KW-CNT-001',
    roleName: '营销文案员',
    department: '市场部',
    description: '撰写与改写营销内容；对外承诺需人工确认后才能定稿外发。',
    personaPrompt: '简洁有重点，保留可追溯来源；不得编造未授权的数据和对外承诺。',
    summary: '面向方案、海报与活动页的内容撰写与改写。',
    workStyles: ['事实先行', '目标明确'],
    expertiseTags: ['业务问答', '资料维护'],
    workModes: ['识别意图', '补齐信息', '确认后执行'],
  },
  'kaiwu-competitor': {
    staffNo: 'KW-CMP-001',
    roleName: '竞品分析专家',
    department: '战略研究',
    description: '基于公开信息做竞品对照；不编造未验证的份额或报价。',
    personaPrompt: '对比表优先，结论带出处；区分已知事实、推断与待核实项。',
    summary: '检索公开竞品信息并整理对照分析。',
    workStyles: ['证据优先', '风险克制'],
    expertiseTags: ['业务问答', '资料维护'],
    workModes: ['查询资料', '执行并复盘'],
  },
  'kaiwu-research': {
    staffNo: 'KW-RSH-001',
    roleName: '情报官',
    department: '行业研究',
    description: '多源公开情报采集与简报；不把传闻写成既定事实。',
    personaPrompt: '覆盖面广，标注时效与来源；传闻只能作为线索，不得升格为结论。',
    summary: '行业与客户情报采集，输出可核对的简报。',
    workStyles: ['证据优先', '事实先行'],
    expertiseTags: ['业务问答', '资料维护'],
    workModes: ['查询资料', '执行并复盘'],
  },
  'kaiwu-brand-auditor': {
    staffNo: 'KW-BRD-001',
    roleName: '品牌诊断员',
    department: '品牌中心',
    description: '扫描公开口碑与品牌呈现；诊断建议供人工决策，不自动对外发声。',
    personaPrompt: '问题清单化，区分事实与判断；不得代替品牌方对外回复或承诺。',
    summary: '公开品牌与口碑扫描，输出诊断报告。',
    workStyles: ['事实先行', '风险克制'],
    expertiseTags: ['业务问答', '资料维护'],
    workModes: ['查询资料', '必要时转人工'],
  },
  'kaiwu-data-tracker': {
    staffNo: 'KW-DAT-001',
    roleName: '数据追踪员',
    department: '运营中心',
    description: '整理业务台账与汇报材料；缺失值不得推测填补。',
    personaPrompt: '口径固定，数字可复核；缺失值保留空缺并明示，禁止脑补。',
    summary: '追踪业务数据，生成台账与汇报材料。',
    workStyles: ['证据优先', '动作可追溯'],
    expertiseTags: ['业务问答', '资料维护', '工具调用'],
    workModes: ['查询资料', '执行并复盘'],
  },
}

export function asStringArray(value) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : []
}

export function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

export function defaultProfileFor(workerId, today = new Date().toISOString().slice(0, 10)) {
  const seed = WORKER_PROFILE_SEED[workerId] || {}
  return {
    displayName: '',
    staffNo: seed.staffNo || '',
    roleName: seed.roleName || '',
    description: seed.description || '',
    personaPrompt: seed.personaPrompt || '',
    summary: seed.summary || '',
    owner: 'admin',
    department: seed.department || '运营中心',
    joinedAt: today,
    status: 'active',
    publishedToGallery: false,
    harnessMaxActions: 32,
    avatarText: '',
    avatarTone: 'blue',
    workStyles: asStringArray(seed.workStyles),
    expertiseTags: asStringArray(seed.expertiseTags),
    workModes: asStringArray(seed.workModes),
  }
}

/**
 * 合并档案：用户已填优先；兼容旧字段 title/boundary/style。
 * 成长记录不落库，由 growthTimeline 派生。status 对照 StaffDeck active/archived。
 */
export function mergeProfile(seededProfile, currentProfile = {}) {
  const cur = currentProfile || {}
  const seed = seededProfile || {}
  const legacyPersona = [cur.boundary, cur.style].filter((item) => typeof item === 'string' && item.trim()).join('\n')
  const status = firstNonEmpty(cur.status, seed.status, 'active') === 'archived' ? 'archived' : 'active'
  const harness = Number(cur.harnessMaxActions ?? cur.harness_max_actions ?? seed.harnessMaxActions ?? 32)
  return {
    displayName: firstNonEmpty(cur.displayName, cur.name, seed.displayName),
    staffNo: firstNonEmpty(cur.staffNo, seed.staffNo),
    roleName: firstNonEmpty(cur.roleName, cur.title, seed.roleName),
    description: firstNonEmpty(cur.description, seed.description),
    personaPrompt: firstNonEmpty(cur.personaPrompt, legacyPersona, seed.personaPrompt),
    summary: firstNonEmpty(cur.summary, cur.system_prompt_summary, seed.summary),
    owner: firstNonEmpty(cur.owner, cur.creator_name, seed.owner, 'admin'),
    department: firstNonEmpty(cur.department, seed.department, '运营中心'),
    joinedAt: firstNonEmpty(cur.joinedAt, cur.onboarded_at, seed.joinedAt),
    status,
    publishedToGallery: cur.publishedToGallery === true || cur.published_to_gallery === true || seed.publishedToGallery === true,
    harnessMaxActions: Number.isFinite(harness) ? Math.max(1, Math.min(100, Math.round(harness))) : 32,
    avatarText: firstNonEmpty(cur.avatarText, cur.avatar_text, seed.avatarText),
    avatarTone: firstNonEmpty(cur.avatarTone, cur.avatar_tone, seed.avatarTone, 'blue'),
    workStyles: asStringArray(cur.workStyles).length ? asStringArray(cur.workStyles) : asStringArray(cur.work_styles).length ? asStringArray(cur.work_styles) : asStringArray(seed.workStyles),
    expertiseTags: asStringArray(cur.expertiseTags).length ? asStringArray(cur.expertiseTags) : asStringArray(cur.expertise_tags).length ? asStringArray(cur.expertise_tags) : asStringArray(seed.expertiseTags),
    workModes: asStringArray(cur.workModes).length ? asStringArray(cur.workModes) : asStringArray(cur.work_modes).length ? asStringArray(cur.work_modes) : asStringArray(seed.workModes),
  }
}

function stableGrowthTimestamp(item = {}) {
  const meta = item.metadata || {}
  const candidates = [
    meta.learned_at,
    meta.assigned_at,
    meta.installed_at,
    meta.imported_at,
    meta.created_at,
    item.createdAt,
    item.created_at,
    item.updatedAt,
    item.updated_at,
  ]
  return candidates.find((value) => typeof value === 'string' && value.trim()) || ''
}

function isMeaningfullyUpdated(createdAt, updatedAt) {
  if (!createdAt || !updatedAt) return false
  return Math.abs(new Date(updatedAt).getTime() - new Date(createdAt).getTime()) > 60 * 1000
}

/** StaffDeck growthTimeline：由已启用 SOP / 技能 / 工具派生；无真实时间戳则不展示（不拿版本号冒充日期）。 */
export function growthTimeline(worker = {}) {
  const events = []
  const sops = worker.sops || []
  const skills = (worker.skills || []).filter((item) => item && item.enabled !== false && item.deleted !== true)
  const tools = (worker.tools || []).filter((item) => item && item.enabled !== false)

  sops.forEach((item, index) => {
    events.push({
      id: `sop-${item.name || index}`,
      kind: '新增 SOP',
      title: item.name || `SOP ${index + 1}`,
      description: '业务流程已挂到该数字员工',
      timestamp: stableGrowthTimestamp(item),
    })
  })

  skills.forEach((item, index) => {
    const upgraded = isMeaningfullyUpdated(item.createdAt || item.created_at, item.updatedAt || item.updated_at)
      || (Number(item.localRevision) || 0) > 0
      || item.modified === true
    events.push({
      id: `skill-${item.id || item.name || index}`,
      kind: upgraded ? '技能升级' : '新增技能',
      title: item.name || item.id || `技能 ${index + 1}`,
      description: upgraded ? '技能说明、权限或运行配置有更新' : '通用能力已挂到该数字员工',
      timestamp: stableGrowthTimestamp(item),
    })
  })

  tools.forEach((item, index) => {
    events.push({
      id: `tool-${item.id || item.name || index}`,
      kind: '新增工具',
      title: item.name || item.id || `工具 ${index + 1}`,
      description: item.description || '工具调用能力已挂到该数字员工',
      timestamp: stableGrowthTimestamp(item),
    })
  })

  return events
    .filter((item) => Boolean(item.title) && isRealTimestamp(item.timestamp))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
}

function isRealTimestamp(value) {
  if (typeof value !== 'string' || !value.trim()) return false
  const ms = Date.parse(value)
  return Number.isFinite(ms)
}

function singleLine(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

/**
 * StaffDeck AgentIdentityPrompt：把档案身份注入 persona，再接交付包执行口径。
 */
export function renderIdentityPersona(displayName, profile = {}, basePersonaText = '') {
  const lines = [
    '你正在扮演一个企业数字员工。请始终以该员工的身份、岗位和职责口径回复用户，不要自称其他员工。',
    `员工名称：${singleLine(displayName) || '数字员工'}`,
  ]
  if (profile.staffNo) lines.push(`工号：${singleLine(profile.staffNo)}`)
  if (profile.roleName) lines.push(`岗位：${singleLine(profile.roleName)}`)
  if (profile.department) lines.push(`部门：${singleLine(profile.department)}`)
  const description = singleLine(profile.description)
  if (description) lines.push(`员工描述：${description}`)
  const styles = asStringArray(profile.workStyles)
  if (styles.length) lines.push(`工作风格：${styles.join('、')}`)
  const expertise = asStringArray(profile.expertiseTags)
  if (expertise.length) lines.push(`擅长领域：${expertise.join('、')}`)
  const modes = asStringArray(profile.workModes)
  if (modes.length) lines.push(`工作方式：${modes.join('、')}`)

  const parts = [lines.join('\n')]
  const base = String(basePersonaText || '').trim()
  if (base) parts.push(base)
  const extra = String(profile.personaPrompt || '').trim()
  if (extra && !base.includes(extra)) {
    parts.push(`员工角色补充要求：\n${extra}`)
  }
  return parts.join('\n\n')
}

/** 从交付包 agent.cordis.yml 取出 persona.config.text（|- 多行块）。 */
export function extractPersonaText(yml = '') {
  const match = /- id:\s*persona\b[\s\S]*?\n\s*text:\s*\|-?\n((?:[ \t]+.*\n?)*)/.exec(String(yml))
  if (!match) return ''
  const indentMatch = /^( +)/m.exec(match[1])
  const indent = indentMatch ? indentMatch[1].length : 6
  return match[1]
    .split('\n')
    .map((line) => (line.length >= indent ? line.slice(indent) : line.replace(/^\s+/, '')))
    .join('\n')
    .replace(/\s+$/, '')
}

/** 写回 persona.config.text，保留其余组件块。 */
export function replacePersonaText(yml = '', personaText = '') {
  const source = String(yml).replace(/\r\n/g, '\n')
  const marker = /^([ \t]*)text:\s*\|-?[ \t]*$/m
  const personaIdx = source.search(/^- id:\s*persona\b/m)
  if (personaIdx < 0) return source
  const fromPersona = source.slice(personaIdx)
  const textMatch = marker.exec(fromPersona)
  if (!textMatch) return source
  const absTextLine = personaIdx + textMatch.index
  const indent = textMatch[1] || '    '
  const bodyIndent = `${indent}  `
  const afterTextLine = source.indexOf('\n', absTextLine)
  if (afterTextLine < 0) return source
  let cursor = afterTextLine + 1
  while (cursor < source.length) {
    const nextNl = source.indexOf('\n', cursor)
    const lineEnd = nextNl < 0 ? source.length : nextNl
    const line = source.slice(cursor, lineEnd)
    if (line.length === 0) {
      cursor = lineEnd + 1
      continue
    }
    if (/^[ \t]+/.test(line) && !/^- id:\s*/.test(line.trimStart())) {
      cursor = lineEnd + (nextNl < 0 ? 0 : 1)
      if (nextNl < 0) break
      continue
    }
    break
  }
  const body = String(personaText || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => `${bodyIndent}${line}`)
    .join('\n')
  return `${source.slice(0, absTextLine)}${indent}text: |-\n${body}\n${source.slice(cursor)}`
}

/** 档案页能力摘要（已启用技能 / 资料 / 工具 / SOP / 定时任务）。 */
export function capabilitySummary(worker = {}) {
  const skills = (worker.skills || []).filter((item) => item && item.enabled !== false && item.deleted !== true)
  const knowledge = worker.knowledge || []
  const tools = (worker.tools || []).filter((item) => item && item.enabled !== false)
  const sops = worker.sops || []
  const tasks = (worker.tasks || []).filter((item) => item && item.enabled !== false)
  return {
    skillCount: skills.length,
    knowledgeCount: knowledge.length,
    toolCount: tools.length,
    sopCount: sops.length,
    taskCount: tasks.length,
    skillNames: skills.map((item) => item.name || item.id).filter(Boolean),
    knowledgeNames: knowledge.map((item) => item.name).filter(Boolean),
    toolNames: tools.map((item) => item.name || item.id).filter(Boolean),
    sopNames: sops.map((item) => item.name).filter(Boolean),
    taskNames: tasks.map((item) => item.name).filter(Boolean),
  }
}

