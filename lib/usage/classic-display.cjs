/**
 * classic-display.js — 浏览器展示公式唯一手写源（无构建）。
 *
 * 与 lib/usage/dashboard.mjs + feedback.mjs 行为对齐；
 * scripts/check-usage-classic-parity.mjs 用同组夹具双向校验。
 * scripts/sync-usage-module.mjs 嵌入 EMBED_START..EMBED_END 到两端 client.js。
 */
/* EMBED_START */
function createKaiwuUsageDisplay() {
  function emptyFeedbackBucket() {
    return { totalFeedback: 0, upCount: 0, downCount: 0 };
  }

  function normalizeFeedbackBucket(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return emptyFeedbackBucket();
    var totalFeedback = Math.max(0, Number(raw.totalFeedback) || 0);
    var upCount = Math.max(0, Number(raw.upCount) || 0);
    var downCount = Math.max(0, Number(raw.downCount) || 0);
    if (upCount + downCount > totalFeedback) totalFeedback = upCount + downCount;
    return { totalFeedback: totalFeedback, upCount: upCount, downCount: downCount };
  }

  function sumFeedbackBuckets(buckets) {
    var acc = emptyFeedbackBucket();
    var list = Array.isArray(buckets) ? buckets : [];
    for (var i = 0; i < list.length; i++) {
      var bucket = normalizeFeedbackBucket(list[i]);
      acc.totalFeedback += bucket.totalFeedback;
      acc.upCount += bucket.upCount;
      acc.downCount += bucket.downCount;
    }
    return acc;
  }

  function employeeDashboardMetrics(sessions, feedback) {
    var bucket = normalizeFeedbackBucket(feedback);
    var feedbackCount = bucket.totalFeedback;
    var conversationCount = Array.isArray(sessions)
      ? sessions.length
      : Math.max(0, Number(sessions) || 0);
    return {
      conversationCount: conversationCount,
      feedbackCount: feedbackCount,
      positiveRate: feedbackCount ? Math.round((bucket.upCount / feedbackCount) * 100) : 0,
      negativeRate: feedbackCount ? Math.round((bucket.downCount / feedbackCount) * 100) : 0
    };
  }

  function conversationCountForWorker(sessionsByWorker, workerId) {
    var id = String(workerId || "").trim();
    if (!id) return 0;
    return Math.max(0, Number((sessionsByWorker && sessionsByWorker[id]) || 0) || 0);
  }

  return {
    emptyFeedbackBucket: emptyFeedbackBucket,
    normalizeFeedbackBucket: normalizeFeedbackBucket,
    sumFeedbackBuckets: sumFeedbackBuckets,
    employeeDashboardMetrics: employeeDashboardMetrics,
    conversationCountForWorker: conversationCountForWorker
  };
}
/* EMBED_END */

if (typeof module !== "undefined" && module.exports) {
  module.exports = Object.assign({ createKaiwuUsageDisplay: createKaiwuUsageDisplay }, createKaiwuUsageDisplay());
}
