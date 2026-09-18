/**
 * AIOps 运维诊断：指标 / 日志 / 变更查询与处置建议（纯函数 + HTTP 适配）。
 *
 * 未配置上游地址时走 demo 样例，保证本地可演示；配置后直连 Prometheus / Loki / GitLab。
 * 写操作仅生成建议，不执行。
 */

const DEFAULT_WINDOW_MINUTES = 15

export function aiopsConfigFromEnv(env = process.env) {
  const prometheusUrl = String(env.KAIWU_PROM_URL || env.PROMETHEUS_URL || '').replace(/\/$/, '')
  const lokiUrl = String(env.KAIWU_LOKI_URL || env.LOKI_URL || '').replace(/\/$/, '')
  const gitlabUrl = String(env.KAIWU_GITLAB_URL || env.GITLAB_URL || '').replace(/\/$/, '')
  const gitlabToken = String(env.KAIWU_GITLAB_TOKEN || env.GITLAB_TOKEN || '')
  const forceDemo = String(env.KAIWU_AIOPS_MODE || '').toLowerCase() === 'demo'
  return {
    prometheusUrl,
    lokiUrl,
    gitlabUrl,
    gitlabToken,
    mode: forceDemo || (!prometheusUrl && !lokiUrl && !gitlabUrl) ? 'demo' : 'live',
  }
}

function clampWindow(minutes, fallback = DEFAULT_WINDOW_MINUTES) {
  const n = Number(minutes)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(24 * 60, Math.max(1, Math.round(n)))
}

function serviceName(raw) {
  return String(raw || '').trim() || 'unknown-service'
}

/** 演示样例：模拟「发布后延迟升高」的典型故障链。 */
export function demoMetrics(service, windowMinutes = DEFAULT_WINDOW_MINUTES) {
  const name = serviceName(service)
  const now = Date.now()
  return {
    mode: 'demo',
    service: name,
    windowMinutes: clampWindow(windowMinutes),
    queriedAt: new Date(now).toISOString(),
    summary: {
      latencyP99Ms: { current: 820, baseline: 180, deltaPct: 356 },
      errorRatePct: { current: 4.6, baseline: 0.3, deltaPct: 1433 },
      cpuPct: { current: 62, baseline: 41 },
      memoryPct: { current: 71, baseline: 58 },
      dbConnections: { current: 96, limit: 100 },
    },
    series: [
      { ts: new Date(now - 40 * 60_000).toISOString(), latencyP99Ms: 170, errorRatePct: 0.2 },
      { ts: new Date(now - 25 * 60_000).toISOString(), latencyP99Ms: 190, errorRatePct: 0.3 },
      { ts: new Date(now - 15 * 60_000).toISOString(), latencyP99Ms: 510, errorRatePct: 2.1 },
      { ts: new Date(now - 5 * 60_000).toISOString(), latencyP99Ms: 820, errorRatePct: 4.6 },
    ],
    notes: [
      '演示数据：未配置 KAIWU_PROM_URL 时返回。',
      `${name} 约 15 分钟前延迟与错误率同步抬升，数据库连接接近上限。`,
    ],
  }
}

export function demoLogs(service, windowMinutes = DEFAULT_WINDOW_MINUTES) {
  const name = serviceName(service)
  const now = Date.now()
  return {
    mode: 'demo',
    service: name,
    windowMinutes: clampWindow(windowMinutes),
    queriedAt: new Date(now).toISOString(),
    matchCount: 3,
    entries: [
      {
        ts: new Date(now - 12 * 60_000).toISOString(),
        level: 'ERROR',
        message: `Timeout acquiring DB connection pool for ${name}`,
      },
      {
        ts: new Date(now - 10 * 60_000).toISOString(),
        level: 'ERROR',
        message: `Handler failed: connection pool exhausted (max=100)`,
      },
      {
        ts: new Date(now - 8 * 60_000).toISOString(),
        level: 'WARN',
        message: `Retrying downstream call inventory-service after 504`,
      },
    ],
    keywords: ['connection pool', 'Timeout', '504'],
    notes: ['演示数据：未配置 KAIWU_LOKI_URL 时返回。'],
  }
}

export function demoChanges(service, windowHours = 6) {
  const name = serviceName(service)
  const now = Date.now()
  const hours = clampWindow(windowHours * 60, 6 * 60) / 60
  return {
    mode: 'demo',
    service: name,
    windowHours: hours,
    queriedAt: new Date(now).toISOString(),
    changes: [
      {
        ts: new Date(now - 18 * 60_000).toISOString(),
        kind: 'deploy',
        title: `Deploy ${name} v2.14.3`,
        detail: 'replicas=3, image tag v2.14.3 (conn pool default raised in config map skipped)',
        source: 'demo-ci',
      },
      {
        ts: new Date(now - 17 * 60_000).toISOString(),
        kind: 'config',
        title: 'ConfigMap order-db-pool updated',
        detail: 'maxIdle raised; maxOpen left at 100',
        source: 'demo-k8s',
      },
      {
        ts: new Date(now - 90 * 60_000).toISOString(),
        kind: 'commit',
        title: 'feat: enlarge worker threads in order handler',
        detail: 'commit demo-abc123',
        source: 'demo-gitlab',
      },
    ],
    notes: ['演示数据：未配置 GitLab/发布源时返回。关联时间线时请对照指标拐点。'],
  }
}

export function buildRemediationProposal({
  service,
  diagnosis = '',
  suspectedCause = '',
  actions = [],
} = {}) {
  const name = serviceName(service)
  const allowed = new Set(['rollback', 'restart', 'scale_out', 'drain_connections', 'page_oncall'])
  const list = (Array.isArray(actions) && actions.length
    ? actions
    : ['rollback', 'scale_out', 'page_oncall'])
    .map((item) => String(item || '').trim())
    .filter((item) => allowed.has(item))

  const catalog = {
    rollback: {
      action: 'rollback',
      risk: 'high',
      title: `回滚 ${name} 到上一稳定版本`,
      requiresConfirm: true,
      steps: ['确认上一版本镜像 tag', '在发布平台执行回滚', '观察 5 分钟延迟与错误率'],
    },
    restart: {
      action: 'restart',
      risk: 'medium',
      title: `滚动重启 ${name}`,
      requiresConfirm: true,
      steps: ['确认就绪探针健康', '逐个重启 Pod', '观察连接池占用'],
    },
    scale_out: {
      action: 'scale_out',
      risk: 'medium',
      title: `临时扩容 ${name}`,
      requiresConfirm: true,
      steps: ['将副本数 +1 或 +2', '观察 CPU/延迟', '排查根因后再缩回'],
    },
    drain_connections: {
      action: 'drain_connections',
      risk: 'medium',
      title: '排空异常数据库连接',
      requiresConfirm: true,
      steps: ['只读查看锁与长事务', '按运维手册终止异常会话', '复核连接数'],
    },
    page_oncall: {
      action: 'page_oncall',
      risk: 'low',
      title: '通知值班并附诊断摘要',
      requiresConfirm: false,
      steps: ['汇总现象/证据/疑似原因', '通过企业值班通道通知'],
    },
  }

  return {
    mode: 'proposal_only',
    service: name,
    diagnosis: String(diagnosis || '').trim(),
    suspectedCause: String(suspectedCause || '').trim(),
    executed: false,
    message: '仅生成处置建议，不会自动执行写操作。高风险动作须人工确认后再由运维执行。',
    proposals: list.map((key) => catalog[key]),
  }
}

async function fetchJson(url, { headers = {}, timeoutMs = 8000 } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { headers, signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

export async function queryMetrics({
  service,
  windowMinutes = DEFAULT_WINDOW_MINUTES,
  config = aiopsConfigFromEnv(),
  fetchImpl = fetchJson,
} = {}) {
  const name = serviceName(service)
  const window = clampWindow(windowMinutes)
  if (config.mode === 'demo' || !config.prometheusUrl) {
    return demoMetrics(name, window)
  }

  const q = encodeURIComponent(`max_over_time(http_request_duration_seconds_bucket{service="${name}"}[${window}m])`)
  try {
    const data = await fetchImpl(`${config.prometheusUrl}/api/v1/query?query=${q}`)
    return {
      mode: 'live',
      service: name,
      windowMinutes: window,
      queriedAt: new Date().toISOString(),
      prometheus: config.prometheusUrl,
      rawStatus: data?.status || 'unknown',
      resultType: data?.data?.resultType || null,
      resultCount: Array.isArray(data?.data?.result) ? data.data.result.length : 0,
      resultSample: Array.isArray(data?.data?.result) ? data.data.result.slice(0, 5) : [],
      notes: [
        '已查询 Prometheus。请结合具体指标名/标签做二次 PromQL；若结果为空，请核对 service 标签是否匹配。',
      ],
    }
  } catch (error) {
    const fallback = demoMetrics(name, window)
    return {
      ...fallback,
      mode: 'demo_fallback',
      liveError: String(error && error.message ? error.message : error),
      notes: [`Prometheus 查询失败，已回退演示数据：${error.message || error}`, ...fallback.notes],
    }
  }
}

export async function searchLogs({
  service,
  query = 'error|timeout|exception',
  windowMinutes = DEFAULT_WINDOW_MINUTES,
  config = aiopsConfigFromEnv(),
  fetchImpl = fetchJson,
} = {}) {
  const name = serviceName(service)
  const window = clampWindow(windowMinutes)
  if (config.mode === 'demo' || !config.lokiUrl) {
    return demoLogs(name, window)
  }

  const endNs = `${Date.now()}000000`
  const startNs = `${Date.now() - window * 60_000}000000`
  const logql = encodeURIComponent(`{service="${name}"} |= "${String(query || 'error').replace(/"/g, '')}"`)
  const url = `${config.lokiUrl}/loki/api/v1/query_range?query=${logql}&start=${startNs}&end=${endNs}&limit=20`
  try {
    const data = await fetchImpl(url)
    const results = data?.data?.result || []
    const entries = []
    for (const stream of results) {
      for (const [ts, line] of stream.values || []) {
        entries.push({
          ts: (() => {
            try {
              return new Date(Number(String(ts).slice(0, 13))).toISOString()
            } catch {
              return new Date().toISOString()
            }
          })(),
          level: /error/i.test(line) ? 'ERROR' : 'INFO',
          message: String(line).slice(0, 500),
        })
      }
    }
    entries.sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts))
    return {
      mode: 'live',
      service: name,
      windowMinutes: window,
      queriedAt: new Date().toISOString(),
      loki: config.lokiUrl,
      matchCount: entries.length,
      entries: entries.slice(0, 20),
      keywords: String(query || '').split(/[|,\s]+/).filter(Boolean).slice(0, 8),
      notes: ['已查询 Loki。若无结果，请核对 LogQL 标签（service/app/job）。'],
    }
  } catch (error) {
    const fallback = demoLogs(name, window)
    return {
      ...fallback,
      mode: 'demo_fallback',
      liveError: String(error && error.message ? error.message : error),
      notes: [`Loki 查询失败，已回退演示数据：${error.message || error}`, ...fallback.notes],
    }
  }
}

export async function listChanges({
  service,
  windowHours = 6,
  config = aiopsConfigFromEnv(),
  fetchImpl = fetchJson,
} = {}) {
  const name = serviceName(service)
  const hours = Math.max(1, Math.min(168, Number(windowHours) || 6))
  if (config.mode === 'demo' || !config.gitlabUrl) {
    return demoChanges(name, hours)
  }

  const since = new Date(Date.now() - hours * 3600_000).toISOString()
  const project = encodeURIComponent(name)
  const url = `${config.gitlabUrl}/api/v4/projects/${project}/events?after=${encodeURIComponent(since.slice(0, 10))}&per_page=20`
  const headers = config.gitlabToken ? { 'PRIVATE-TOKEN': config.gitlabToken } : {}
  try {
    const data = await fetchImpl(url, { headers })
    const rows = Array.isArray(data) ? data : []
    return {
      mode: 'live',
      service: name,
      windowHours: hours,
      queriedAt: new Date().toISOString(),
      gitlab: config.gitlabUrl,
      changes: rows.slice(0, 20).map((item) => ({
        ts: item.created_at || '',
        kind: item.action_name || item.target_type || 'event',
        title: item.target_title || item.action_name || 'gitlab-event',
        detail: JSON.stringify(item).slice(0, 300),
        source: 'gitlab',
      })),
      notes: [
        '已查询 GitLab events。项目 path 默认等于 service 名；若 404，请改用真实 project path。',
      ],
    }
  } catch (error) {
    const fallback = demoChanges(name, hours)
    return {
      ...fallback,
      mode: 'demo_fallback',
      liveError: String(error && error.message ? error.message : error),
      notes: [`GitLab 查询失败，已回退演示数据：${error.message || error}`, ...fallback.notes],
    }
  }
}
