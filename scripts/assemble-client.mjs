/**
 * 从 lib/client-src/ 组装 lib/client.js（classic ModuleLoader bundle，无 bundler）。
 *
 * 编辑流程：改 client-src 各分片 → node scripts/assemble-client.mjs
 * （可选）再跑 sync-usage-module.mjs 刷新 01-usage-display 嵌入块。
 */
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const srcDir = join(root, 'lib/client-src')
const outFile = join(root, 'lib/client.js')
const manifest = JSON.parse(readFileSync(join(srcDir, 'manifest.json'), 'utf8'))

assert.ok(Array.isArray(manifest.files) && manifest.files.length > 0, 'manifest.files 不能为空')

const parts = []
for (const name of manifest.files) {
  let body = readFileSync(join(srcDir, name), 'utf8')
  if (body.startsWith('/* client-src/')) {
    const nl = body.indexOf('\n')
    body = nl >= 0 ? body.slice(nl + 1) : ''
  }
  parts.push(body)
}

// header 与 usage 块之间保留空行，贴近历史格式
if (parts[0] && parts[1] && !parts[0].endsWith('\n\n') && parts[1].startsWith('/* BEGIN_KAIWU_USAGE_DISPLAY')) {
  parts[0] = parts[0].endsWith('\n') ? `${parts[0]}\n` : `${parts[0]}\n\n`
}

const assembled = parts.join('')
writeFileSync(outFile, assembled, 'utf8')

// 基础完整性
assert.match(assembled, /window\.__ModuleLoader__\.load/)
assert.match(assembled, /BEGIN_KAIWU_USAGE_DISPLAY/)
assert.match(assembled, /function PlazaOverlay/)
assert.match(assembled, /function AdminPanel/)
assert.match(assembled, /exports\.apply = apply/)

console.log(`assemble-client: ok → lib/client.js (${assembled.split(/\n/).length} lines, ${manifest.files.length} parts)`)
