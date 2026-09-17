/**
 * 将员工端 lib/usage/ 同步到企业端，并把 classic-display 嵌入两端 client.js。
 *
 * 真相源：kaiwu-praxis/lib/usage/
 * 企业端保持同文副本（独立安装，不能依赖员工端包）。
 */
import assert from 'node:assert/strict'
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const here = dirname(fileURLToPath(import.meta.url))
const employeeRoot = join(here, '..')
const enterpriseRoot = join(here, '../../kaiwu-praxis-enterprise')
const usageSrc = join(employeeRoot, 'lib/usage')
const usageDst = join(enterpriseRoot, 'lib/usage')
const require = createRequire(import.meta.url)

const BEGIN = '/* BEGIN_KAIWU_USAGE_DISPLAY */'
const END = '/* END_KAIWU_USAGE_DISPLAY */'

function listFiles(dir, prefix = '') {
  const out = []
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${name.name}` : name.name
    if (name.isDirectory()) out.push(...listFiles(join(dir, name.name), rel))
    else out.push(rel)
  }
  return out.sort()
}

rmSync(usageDst, { recursive: true, force: true })
mkdirSync(usageDst, { recursive: true })
cpSync(usageSrc, usageDst, { recursive: true })

const srcFiles = listFiles(usageSrc)
const dstFiles = listFiles(usageDst)
assert.deepEqual(dstFiles, srcFiles, 'enterprise lib/usage 文件列表应与员工端一致')
for (const rel of srcFiles) {
  assert.equal(
    readFileSync(join(usageSrc, rel), 'utf8'),
    readFileSync(join(usageDst, rel), 'utf8'),
    `enterprise lib/usage/${rel} 必须与员工端同文`,
  )
}

writeFileSync(
  join(enterpriseRoot, 'lib/usage-metrics.mjs'),
  "/** 兼容入口：请优先从 `./usage/index.mjs` 导入。 */\nexport * from './usage/index.mjs'\n",
  'utf8',
)

// 校验 classic factory 可加载
const classic = require(join(usageSrc, 'classic-display.cjs'))
assert.equal(typeof classic.createKaiwuUsageDisplay, 'function')
assert.deepEqual(
  classic.employeeDashboardMetrics(2, { totalFeedback: 4, upCount: 3, downCount: 1 }),
  { conversationCount: 2, feedbackCount: 4, positiveRate: 75, negativeRate: 25 },
)

const classicSource = readFileSync(join(usageSrc, 'classic-display.cjs'), 'utf8')
const embedStart = classicSource.indexOf('/* EMBED_START */')
const embedEnd = classicSource.indexOf('/* EMBED_END */')
assert.ok(embedStart >= 0 && embedEnd > embedStart, 'classic-display.cjs 缺少 EMBED_START/END')
const factoryBody = classicSource.slice(embedStart + '/* EMBED_START */'.length, embedEnd).trim()

const embed = [
  BEGIN,
  '    var KaiwuUsageDisplay = (function () {',
  factoryBody.split('\n').map((line) => `      ${line}`).join('\n'),
  '      return createKaiwuUsageDisplay();',
  '    })();',
  END,
].join('\n')

function embedIntoClient(clientPath) {
  const text = readFileSync(clientPath, 'utf8')
  const beginIdx = text.indexOf(BEGIN)
  const endIdx = text.indexOf(END)
  let next
  if (beginIdx >= 0 && endIdx > beginIdx) {
    next = text.slice(0, beginIdx) + embed + text.slice(endIdx + END.length)
  } else {
    const needle = 'var React = require("react");'
    const at = text.indexOf(needle)
    assert.ok(at >= 0, `找不到 React require: ${clientPath}`)
    const insertAt = at + needle.length
    next = `${text.slice(0, insertAt)}\n\n${embed}\n${text.slice(insertAt)}`
  }
  writeFileSync(clientPath, next, 'utf8')
}

// 员工端：写入 client-src 分片后组装；企业端仍直接嵌入 client.js。
const employeeUsagePart = join(employeeRoot, 'lib/client-src/01-usage-display.js')
writeFileSync(
  employeeUsagePart,
  `/* client-src/01-usage-display.js — 由 sync-usage-module 维护；勿手改公式 */\n${embed}\n`,
  'utf8',
)
const { spawnSync } = await import('node:child_process')
const assembled = spawnSync(process.execPath, [join(here, 'assemble-client.mjs')], {
  cwd: employeeRoot,
  encoding: 'utf8',
})
assert.equal(assembled.status, 0, assembled.stderr || assembled.stdout || 'assemble-client failed')
embedIntoClient(join(enterpriseRoot, 'lib/client.js'))

console.log('sync-usage-module: ok')
console.log(`  mirrored ${srcFiles.length} files → kaiwu-praxis-enterprise/lib/usage/`)
console.log('  refreshed client-src/01-usage-display.js + assembled lib/client.js')
console.log('  embedded classic-display into enterprise lib/client.js')
