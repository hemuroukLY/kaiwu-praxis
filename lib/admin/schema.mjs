/**
 * kaiwu-praxis settings 的 Schemastery 契约。
 */
import z from '@deepseek-ai/schemastery'
import { DEFAULT_HUB_URL } from '../enterprise-endpoint.mjs'
import { CAPABILITY_VERSION, PACKAGE_SOURCE } from './constants.mjs'

export const DocSchema = z.object({
  name: z.string().default(''),
  content: z.string().default(''),
})

export const SkillSchema = z.object({
  id: z.string().default(''),
  name: z.string().default(''),
  description: z.string().default(''),
  content: z.string().default(''),
  enabled: z.boolean().default(true),
  deleted: z.boolean().default(false),
  source: z.string().default(PACKAGE_SOURCE),
  baseVersion: z.string().default(CAPABILITY_VERSION),
  packageVersion: z.string().default(CAPABILITY_VERSION),
  localRevision: z.number().default(0),
  modified: z.boolean().default(false),
})

/**
 * StaffDeck `/enterprise/dashboard` 档案契约：
 * - 身份 / 描述 / 标签；成长记录由 growthTimeline 派生
 * - 指标：对话次数 / 反馈次数 / 好评率 / 差评率（无数据时为 0）
 */
export const ProfileSchema = z.object({
  displayName: z.string().default(''),
  staffNo: z.string().default(''),
  roleName: z.string().default(''),
  description: z.string().default(''),
  personaPrompt: z.string().default(''),
  summary: z.string().default(''),
  owner: z.string().default('admin'),
  department: z.string().default('运营中心'),
  joinedAt: z.string().default(''),
  status: z.string().default('active'),
  publishedToGallery: z.boolean().default(false),
  harnessMaxActions: z.number().default(32),
  avatarText: z.string().default(''),
  avatarTone: z.string().default('blue'),
  workStyles: z.array(z.string()).default([]),
  expertiseTags: z.array(z.string()).default([]),
  workModes: z.array(z.string()).default([]),
  title: z.string().default(''),
  boundary: z.string().default(''),
  style: z.string().default(''),
})

export const TaskSchema = z.object({
  name: z.string().default(''),
  schedule: z.string().default(''),
  prompt: z.string().default(''),
  enabled: z.boolean().default(true),
})

export const ToolSchema = z.object({
  id: z.string().default(''),
  name: z.string().default(''),
  description: z.string().default(''),
  source: z.string().default(''),
  componentId: z.string().default(''),
  runtimeNames: z.array(z.string()).default([]),
  enabled: z.boolean().default(true),
  baseVersion: z.string().default(CAPABILITY_VERSION),
  packageVersion: z.string().default(CAPABILITY_VERSION),
  localRevision: z.number().default(0),
  modified: z.boolean().default(false),
})

export const WorkerSchema = z.object({
  profile: ProfileSchema.default({}),
  knowledge: z.array(DocSchema).default([]),
  memories: z.array(DocSchema).default([]),
  sops: z.array(DocSchema).default([]),
  tasks: z.array(TaskSchema).default([]),
  skills: z.array(SkillSchema).default([]),
  tools: z.array(ToolSchema).default([]),
})

export const FeedbackBucketSchema = z.object({
  totalFeedback: z.number().default(0),
  upCount: z.number().default(0),
  downCount: z.number().default(0),
})

export const EnterpriseSchema = z.object({
  hubUrl: z.string().default(DEFAULT_HUB_URL),
  enrollmentCode: z.string().default(''),
  terminalName: z.string().default(''),
  status: z.string().default('未注册'),
  terminalId: z.string().default(''),
  enterpriseName: z.string().default(''),
  lastConnectedAt: z.string().default(''),
  lastError: z.string().default(''),
  sessionCount: z.number().default(0),
  sessionsByWorker: z.dict(z.number()).default({}),
  feedbackByWorker: z.dict(FeedbackBucketSchema).default({}),
})

export const AdminSchema = z.object({
  workers: z.dict(WorkerSchema).default({}),
  tempWorkspacePath: z.string().default(''),
  enterprise: EnterpriseSchema.default({}),
})
