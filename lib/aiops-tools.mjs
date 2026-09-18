/**
 * 开物 AIOps 工具：运维诊断员使用的只读查询 + 处置建议（不自动执行）。
 */
import {
  aiopsConfigFromEnv,
  buildRemediationProposal,
  listChanges,
  queryMetrics,
  searchLogs,
} from './aiops-core.mjs'

export const name = 'kaiwu-praxis-aiops-tools'
export const inject = ['tools']

function textBlock(title, value) {
  return [{ type: 'text', text: `${title}\n${JSON.stringify(value, null, 2)}` }]
}

export function apply(ctx, config = {}) {
  const getConfig = () => aiopsConfigFromEnv(process.env)

  ctx.tools.register({
    name: 'query_metrics',
    description:
      '查询服务运行指标（延迟、错误率、资源等）。未配置 Prometheus 时返回可演示的样例数据。用于故障诊断第一步。',
    parameters: {
      type: 'object',
      properties: {
        service: { type: 'string', description: '服务名，如 order-service' },
        windowMinutes: { type: 'integer', description: '回看窗口（分钟），默认 15' },
      },
      required: ['service'],
      additionalProperties: false,
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => textBlock('【指标查询】', value),
    },
    async execute(args) {
      return queryMetrics({
        service: args.service,
        windowMinutes: args.windowMinutes,
        config: getConfig(),
      })
    },
  })

  ctx.tools.register({
    name: 'search_logs',
    description:
      '检索服务错误/异常日志。未配置 Loki 时返回演示日志。用于解释指标异常的原因线索。',
    parameters: {
      type: 'object',
      properties: {
        service: { type: 'string', description: '服务名' },
        query: { type: 'string', description: '关键词，默认 error|timeout|exception' },
        windowMinutes: { type: 'integer', description: '回看窗口（分钟），默认 15' },
      },
      required: ['service'],
      additionalProperties: false,
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => textBlock('【日志检索】', value),
    },
    async execute(args) {
      return searchLogs({
        service: args.service,
        query: args.query,
        windowMinutes: args.windowMinutes,
        config: getConfig(),
      })
    },
  })

  ctx.tools.register({
    name: 'list_changes',
    description:
      '列出服务近期发布、配置或代码变更。未配置 GitLab 时返回演示变更时间线。用于关联故障与变更。',
    parameters: {
      type: 'object',
      properties: {
        service: { type: 'string', description: '服务名 / 项目 path' },
        windowHours: { type: 'integer', description: '回看小时数，默认 6' },
      },
      required: ['service'],
      additionalProperties: false,
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => textBlock('【变更记录】', value),
    },
    async execute(args) {
      return listChanges({
        service: args.service,
        windowHours: args.windowHours,
        config: getConfig(),
      })
    },
  })

  ctx.tools.register({
    name: 'propose_remediation',
    description:
      '根据诊断结论生成处置建议（回滚/重启/扩容/通知值班等）。只产出建议与步骤，绝不自动执行写操作。',
    parameters: {
      type: 'object',
      properties: {
        service: { type: 'string', description: '服务名' },
        diagnosis: { type: 'string', description: '故障现象摘要' },
        suspectedCause: { type: 'string', description: '疑似根因' },
        actions: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['rollback', 'restart', 'scale_out', 'drain_connections', 'page_oncall'],
          },
          description: '建议动作列表；缺省为 rollback + scale_out + page_oncall',
        },
      },
      required: ['service'],
      additionalProperties: false,
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => textBlock('【处置建议·未执行】', value),
    },
    async execute(args) {
      return buildRemediationProposal({
        service: args.service,
        diagnosis: args.diagnosis,
        suspectedCause: args.suspectedCause,
        actions: args.actions,
      })
    },
  })
}
