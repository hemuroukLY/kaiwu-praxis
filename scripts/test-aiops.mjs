/**
 * AIOps 核心纯函数单测。
 */
import assert from 'node:assert/strict'
import {
  aiopsConfigFromEnv,
  buildRemediationProposal,
  demoChanges,
  demoLogs,
  demoMetrics,
  listChanges,
  queryMetrics,
  searchLogs,
} from '../lib/aiops-core.mjs'

assert.equal(aiopsConfigFromEnv({ KAIWU_AIOPS_MODE: 'demo' }).mode, 'demo')
assert.equal(aiopsConfigFromEnv({}).mode, 'demo')
assert.equal(aiopsConfigFromEnv({ KAIWU_PROM_URL: 'http://prom:9090' }).mode, 'live')

const metrics = demoMetrics('order-service', 15)
assert.equal(metrics.service, 'order-service')
assert.ok(metrics.summary.latencyP99Ms.current > metrics.summary.latencyP99Ms.baseline)

const logs = demoLogs('order-service')
assert.ok(logs.entries.length >= 1)
assert.ok(logs.keywords.includes('connection pool') || logs.entries[0].message.includes('pool'))

const changes = demoChanges('order-service')
assert.ok(changes.changes.some((item) => item.kind === 'deploy'))

const proposal = buildRemediationProposal({
  service: 'order-service',
  diagnosis: '延迟升高',
  suspectedCause: '发布后连接池耗尽',
  actions: ['rollback', 'page_oncall'],
})
assert.equal(proposal.executed, false)
assert.equal(proposal.mode, 'proposal_only')
assert.equal(proposal.proposals.length, 2)
assert.ok(proposal.proposals.every((item) => item.action))

const q = await queryMetrics({ service: 'order-service', config: { mode: 'demo' } })
assert.equal(q.mode, 'demo')
const s = await searchLogs({ service: 'order-service', config: { mode: 'demo' } })
assert.equal(s.mode, 'demo')
const c = await listChanges({ service: 'order-service', config: { mode: 'demo' } })
assert.equal(c.mode, 'demo')

console.log('test-aiops: ok')
