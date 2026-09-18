// 基础结构校验：路径中包含中文时仍可导入模块，并检查全部随包 preset 的关键文件。
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const toolsUrl = pathToFileURL(resolve(root, 'lib', 'files-tools.mjs')).href
const tools = await import(toolsUrl)

assert.equal(tools.name, 'kaiwu-praxis-files-tools')
assert.ok(Array.isArray(tools.inject) && tools.inject.includes('tools'))

const workerIds = [
  'kaiwu-watermark',
  'kaiwu-docbutler',
  'kaiwu-content',
  'kaiwu-competitor',
  'kaiwu-research',
  'kaiwu-brand-auditor',
  'kaiwu-data-tracker',
  'kaiwu-aiops',
]

for (const id of workerIds) {
  const presetDir = resolve(root, 'presets', id)
  const requiredFiles = [
    resolve(presetDir, 'preset.yml'),
    resolve(presetDir, 'agent.cordis.yml'),
  ]
  for (const file of requiredFiles) assert.equal(existsSync(file), true, `missing ${file}`)

  const composition = readFileSync(resolve(presetDir, 'agent.cordis.yml'), 'utf8')
  assert.match(composition, /^\s*-\s+id\s*:/m, `${id} composition has no component id`)
  assert.match(composition, /^\s+name\s*:/m, `${id} composition has no component name`)

  const skillFile = resolve(presetDir, 'skills', id, 'SKILL.md')
  assert.equal(existsSync(skillFile), true, `missing ${skillFile}`)
  assert.match(readFileSync(skillFile, 'utf8'), /^---\s*$/m, `${id} skill has no frontmatter`)
}

console.log(JSON.stringify({ ok: true, checks: workerIds.length, workers: workerIds }, null, 2))
