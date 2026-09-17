/**
 * 保证企业端 lib/usage 与员工端同文镜像（先跑 sync-usage-module.mjs）。
 */
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const employee = join(here, '../lib/usage')
const enterprise = join(here, '../../kaiwu-praxis-enterprise/lib/usage')

assert.ok(existsSync(enterprise), '缺少企业端 lib/usage，请先: node scripts/sync-usage-module.mjs')

function listFiles(dir, prefix = '') {
  const out = []
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${name.name}` : name.name
    if (name.isDirectory()) out.push(...listFiles(join(dir, name.name), rel))
    else out.push(rel)
  }
  return out.sort()
}

const left = listFiles(employee)
const right = listFiles(enterprise)
assert.deepEqual(right, left, 'lib/usage 文件列表不一致')
for (const rel of left) {
  assert.equal(
    readFileSync(join(employee, rel), 'utf8'),
    readFileSync(join(enterprise, rel), 'utf8'),
    `lib/usage/${rel} 镜像不一致；请运行 node scripts/sync-usage-module.mjs`,
  )
}

const employeeCompat = readFileSync(join(here, '../lib/usage-metrics.mjs'), 'utf8')
const enterpriseCompat = readFileSync(join(here, '../../kaiwu-praxis-enterprise/lib/usage-metrics.mjs'), 'utf8')
assert.match(employeeCompat, /export \* from '\.\/usage\/index\.mjs'/)
assert.match(enterpriseCompat, /export \* from '\.\/usage\/index\.mjs'/)

console.log('check-usage-metrics-parity: ok')
