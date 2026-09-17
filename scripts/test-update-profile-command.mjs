/**
 * 员工端：企业下发 updateProfile 后 merge + 物化契约。
 */
import assert from 'node:assert/strict'
import { defaultProfileFor, mergeProfile } from '../lib/admin.mjs'

// 模拟 applyEnterpriseCommand 的档案分支
function applyUpdateProfile(workers, workerId, profile) {
  const next = structuredClone(workers)
  if (!next[workerId]) return next
  next[workerId].profile = mergeProfile(defaultProfileFor(workerId), profile || {})
  return next
}

const before = {
  'kaiwu-watermark': {
    profile: defaultProfileFor('kaiwu-watermark', '2026-01-01'),
    knowledge: [],
    sops: [],
    skills: [],
    tools: [],
  },
}

const after = applyUpdateProfile(before, 'kaiwu-watermark', {
  roleName: '企业岗位',
  personaPrompt: '企业执行约束',
  workStyles: ['目标明确'],
  staffNo: 'ENT-001',
})

assert.equal(after['kaiwu-watermark'].profile.roleName, '企业岗位')
assert.equal(after['kaiwu-watermark'].profile.personaPrompt, '企业执行约束')
assert.deepEqual(after['kaiwu-watermark'].profile.workStyles, ['目标明确'])
assert.equal(after['kaiwu-watermark'].profile.staffNo, 'ENT-001')
assert.equal(after['kaiwu-watermark'].profile.department, '信息安全')

console.log('test-update-profile-command: ok')
