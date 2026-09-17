/**
 * 员工端企业连接：持久终端身份、一次性注册码、终端令牌与幂等指令回执。
 */
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { hostname } from 'node:os'
import { basename, join } from 'node:path'

const DEFAULT_HUB_URL = 'http://127.0.0.1:3099'
const VERSION = '0.5.2'
const STATE_LIMIT = 500

function normalizeHubUrl(value) {
  const raw = String(value || process.env.KAIWU_ENTERPRISE_HUB_URL || DEFAULT_HUB_URL).trim().replace(/\/+$/, '')
  const url = new URL(raw)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('企业管理地址必须使用 http 或 https')
  return url.toString().replace(/\/$/, '')
}

function stateFile(dshHome) {
  return join(dshHome, '.kaiwu-enterprise', 'terminal.json')
}

async function saveState(dshHome, state) {
  const file = stateFile(dshHome)
  await mkdir(join(dshHome, '.kaiwu-enterprise'), { recursive: true })
  await writeFile(file, `${JSON.stringify(state, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
}

export async function loadTerminalState(dshHome) {
  let state
  try {
    state = JSON.parse(await readFile(stateFile(dshHome), 'utf8'))
  } catch {
    state = {}
  }
  if (!state.terminalId) state.terminalId = `terminal-${randomUUID()}`
  if (!state.executed || typeof state.executed !== 'object') state.executed = {}
  await saveState(dshHome, state)
  return state
}

export function terminalIdentity(dshHome, enterprise = {}, terminalId = '') {
  const profile = basename(dshHome) || 'dsh'
  const portArg = process.argv.findIndex((value) => value === '--port')
  const port = portArg >= 0 ? process.argv[portArg + 1] : ''
  return {
    id: terminalId,
    name: String(enterprise.terminalName || '').trim() || (port ? `${profile} · ${port}` : profile),
    hostname: hostname(),
    port: port ? Number(port) : 0,
    role: 'endpoint',
    version: VERSION,
  }
}

async function request(hubUrl, path, { token = '', body, timeout = 5000 } = {}) {
  const headers = { 'content-type': 'application/json; charset=utf-8' }
  if (token) headers.authorization = `Bearer ${token}`
  const response = await fetch(`${hubUrl}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  })
  const value = await response.json().catch(() => ({}))
  if (!response.ok) throw Object.assign(new Error(value.error || `企业中枢返回 ${response.status}`), { status: response.status })
  return value
}

export async function syncEnterpriseTerminal({ dshHome, enterprise = {}, workers = {}, sessionCount = 0, sessionsByWorker = {}, feedbackByWorker, executeCommand }) {
  const hubUrl = normalizeHubUrl(enterprise.hubUrl)
  const state = await loadTerminalState(dshHome)
  if (state.hubUrl && state.hubUrl !== hubUrl) {
    state.token = ''
    state.enterpriseName = ''
  }
  state.hubUrl = hubUrl
  const identity = terminalIdentity(dshHome, enterprise, state.terminalId)

  if (!state.token) {
    const enrollmentCode = String(enterprise.enrollmentCode || process.env.KAIWU_ENTERPRISE_ENROLLMENT_CODE || '').trim()
    if (!enrollmentCode) return { status: '未注册', terminalId: state.terminalId, hubUrl, enterpriseName: '', lastError: '' }
    const enrolled = await request(hubUrl, '/api/enroll', { body: { ...identity, enrollmentCode } })
    state.token = enrolled.token
    state.enterpriseName = enrolled.enterpriseName || ''
    await saveState(dshHome, state)
  }

  let response
  try {
    const body = { ...identity, workers, sessionCount, sessionsByWorker }
    // undefined = 本轮未采到反馈，省略字段以保留中枢旧值（避免空 {} 抹数）。
    if (feedbackByWorker !== undefined) body.feedbackByWorker = feedbackByWorker
    response = await request(hubUrl, '/api/terminal/heartbeat', {
      token: state.token,
      body,
    })
  } catch (error) {
    if (error.status === 401) {
      state.token = ''
      await saveState(dshHome, state)
    }
    throw error
  }

  state.enterpriseName = response.enterpriseName || state.enterpriseName || ''
  for (const command of response.commands || []) {
    const previous = state.executed[command.id]
    if (previous) {
      await request(hubUrl, `/api/terminal/commands/${encodeURIComponent(command.id)}/ack`, { token: state.token, body: { terminalId: state.terminalId, success: previous.success, result: previous.result } })
      continue
    }
    await request(hubUrl, `/api/terminal/commands/${encodeURIComponent(command.id)}/start`, { token: state.token, body: { terminalId: state.terminalId } })
    let outcome
    try {
      await executeCommand(command)
      outcome = { success: true, result: '成功', executedAt: new Date().toISOString() }
    } catch (error) {
      outcome = { success: false, result: `失败：${error.message}`, executedAt: new Date().toISOString() }
    }
    state.executed[command.id] = outcome
    const ids = Object.keys(state.executed).sort((a, b) => String(state.executed[b].executedAt).localeCompare(String(state.executed[a].executedAt)))
    for (const id of ids.slice(STATE_LIMIT)) delete state.executed[id]
    await saveState(dshHome, state)
    await request(hubUrl, `/api/terminal/commands/${encodeURIComponent(command.id)}/ack`, { token: state.token, body: { terminalId: state.terminalId, success: outcome.success, result: outcome.result } })
  }
  await saveState(dshHome, state)
  return {
    status: '已连接',
    terminalId: state.terminalId,
    hubUrl,
    enterpriseName: state.enterpriseName,
    lastConnectedAt: new Date().toISOString(),
    lastError: '',
    clearEnrollmentCode: true,
  }
}

export { DEFAULT_HUB_URL, VERSION }
