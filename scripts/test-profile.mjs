/**
 * StaffDeck 对齐：员工档案数据契约单测（不启浏览器）。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  capabilitySummary,
  defaultProfileFor,
  employeeDashboardMetrics,
  extractPersonaText,
  foldMessageFeedbackItems,
  growthTimeline,
  mergeProfile,
  renderIdentityPersona,
  replacePersonaText,
} from '../lib/admin.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const seed = defaultProfileFor('kaiwu-watermark', '2026-09-16')
assert.equal(seed.staffNo, 'KW-WM-001')
assert.equal(seed.roleName, '文件安全助手')
assert.ok(seed.workStyles.length >= 1)
assert.ok(seed.personaPrompt.includes('严谨'))

const merged = mergeProfile(seed, {
  title: '旧岗位名',
  boundary: '旧边界',
  style: '旧风格',
  summary: '用户摘要',
})
assert.equal(merged.roleName, '旧岗位名', '兼容旧 title → roleName')
assert.match(merged.personaPrompt, /旧边界/)
assert.equal(merged.summary, '用户摘要')
assert.equal(merged.staffNo, 'KW-WM-001')

const preferNew = mergeProfile(seed, {
  roleName: '新岗位',
  personaPrompt: '新约束',
  workStyles: ['目标明确'],
})
assert.equal(preferNew.roleName, '新岗位')
assert.equal(preferNew.personaPrompt, '新约束')
assert.deepEqual(preferNew.workStyles, ['目标明确'])

assert.deepEqual(employeeDashboardMetrics([], null), {
  conversationCount: 0,
  feedbackCount: 0,
  positiveRate: 0,
  negativeRate: 0,
})

assert.deepEqual(
  employeeDashboardMetrics([{ id: 'a' }, { id: 'b' }], {
    totalFeedback: 4,
    upCount: 3,
    downCount: 1,
  }),
  {
    conversationCount: 2,
    feedbackCount: 4,
    positiveRate: 75,
    negativeRate: 25,
  },
)

assert.deepEqual(
  foldMessageFeedbackItems({}, 'kaiwu-watermark', [
    { rating: 'positive' },
    { rating: 'positive' },
    { rating: 'negative' },
    { rating: 'ignored' },
  ]),
  { 'kaiwu-watermark': { totalFeedback: 3, upCount: 2, downCount: 1 } },
)
assert.deepEqual(
  foldMessageFeedbackItems(
    { 'kaiwu-watermark': { totalFeedback: 3, upCount: 2, downCount: 1 } },
    'kaiwu-watermark',
    [{ rating: 'positive' }],
  ),
  { 'kaiwu-watermark': { totalFeedback: 4, upCount: 3, downCount: 1 } },
)

assert.equal(growthTimeline({ skills: [], sops: [], tools: [] }).length, 0)

// 无真实时间戳时不展示（禁止用 packageVersion 冒充成长日期）
assert.equal(growthTimeline({
  skills: [{ id: 's1', name: '查资料', enabled: true, packageVersion: '0.2.0' }],
  tools: [{ id: 't1', name: 'watermark', enabled: true, packageVersion: '0.2.0' }],
  sops: [{ name: '无日期 SOP' }],
}).length, 0)

const dated = growthTimeline({
  sops: [{ name: '报销审批', createdAt: '2026-09-01T10:00:00.000Z' }],
  skills: [
    { id: 's1', name: '查资料', enabled: true, createdAt: '2026-09-02T10:00:00.000Z' },
    { id: 's2', name: '已删', enabled: false, deleted: true, createdAt: '2026-09-02T10:00:00.000Z' },
    { id: 's3', name: '升级技能', enabled: true, modified: true, localRevision: 2, createdAt: '2026-09-03T10:00:00.000Z', updatedAt: '2026-09-10T10:00:00.000Z' },
  ],
  tools: [{ id: 't1', name: 'watermark', enabled: true, createdAt: '2026-09-04T10:00:00.000Z' }],
})
assert.equal(dated.some((item) => item.kind === '新增 SOP' && item.title === '报销审批'), true)
assert.equal(dated.some((item) => item.kind === '新增技能' && item.title === '查资料'), true)
assert.equal(dated.some((item) => item.kind === '技能升级' && item.title === '升级技能'), true)
assert.equal(dated.some((item) => item.kind === '新增工具' && item.title === 'watermark'), true)
assert.equal(dated.some((item) => item.title === '已删'), false)

const caps = capabilitySummary({
  sops: [{ name: '报销审批' }],
  skills: [
    { id: 's1', name: '查资料', enabled: true },
    { id: 's2', name: '已删', enabled: false, deleted: true },
  ],
  tools: [{ id: 't1', name: 'watermark', enabled: true }],
  knowledge: [{ name: '制度.pdf' }],
  tasks: [{ name: '早报', enabled: true }, { name: '停用', enabled: false }],
})
assert.equal(caps.skillCount, 1)
assert.equal(caps.sopCount, 1)
assert.equal(caps.toolCount, 1)
assert.equal(caps.knowledgeCount, 1)
assert.equal(caps.taskCount, 1)

const shipped = readFileSync(join(HERE, '../presets/kaiwu-watermark/agent.cordis.yml'), 'utf8')
const basePersona = extractPersonaText(shipped)
assert.match(basePersona, /水印工具/)
const identity = renderIdentityPersona('水印工具', seed, basePersona)
assert.match(identity, /员工名称：水印工具/)
assert.match(identity, /岗位：文件安全助手/)
assert.match(identity, /工号：KW-WM-001/)
assert.match(identity, /员工角色补充要求/)
assert.match(identity, /kaiwu-watermark/)

const rewritten = replacePersonaText(shipped, identity)
assert.match(rewritten, /岗位：文件安全助手/)
assert.match(rewritten, /- id: kaiwu-tool-policy/)
assert.equal(extractPersonaText(rewritten).includes('岗位：文件安全助手'), true)
assert.equal(extractPersonaText(rewritten).includes('批量给 PDF'), true)

console.log('test-profile: ok')
