/** 反馈拉取并发与会话扫描上限。 */
export const FEEDBACK_CONCURRENCY = 4
export const FEEDBACK_SESSION_CAP = 80

/**
 * Host 会话 seq=0：尚无有效 transcript（空白/冷启动占位）。
 * 计入用量与反馈扫描时一律跳过。
 */
export const EMPTY_TRANSCRIPT_SEQ = 0

/** 开物数字员工 preset id 前缀。 */
export const KAIWU_WORKER_ID_PREFIX = 'kaiwu-'
