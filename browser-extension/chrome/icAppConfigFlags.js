/**
 * GET /api/app-config (public shape, no secrets).
 * @param {string} apiBase
 * @returns {Promise<Record<string, unknown> | null>}
 */
window.ICFetchPublicAppConfig = async function ICFetchPublicAppConfig(apiBase) {
  const base = (apiBase || "").trim().replace(/\/$/, "") || "http://127.0.0.1:3001";
  try {
    const res = await fetch(`${base}/api/app-config`);
    const data = await res.json().catch(() => null);
    if (res.ok && data && typeof data === "object") {
      return data;
    }
  } catch {
    /* ignore */
  }
  return null;
};

/**
 * @param {Record<string, unknown> | null} cfg
 * @returns {{
 *   anyRealtimeKey: boolean;
 *   selectedProviderHasKey: boolean;
 *   liveRealtimeProvider: string;
 * }}
 */
window.ICLiveRealtimeFromPublicConfig = function ICLiveRealtimeFromPublicConfig(cfg) {
  if (!cfg || typeof cfg !== "object") {
    return { anyRealtimeKey: false, selectedProviderHasKey: false, liveRealtimeProvider: "" };
  }
  const o = Boolean(cfg.openaiApiKeyConfigured);
  const g = Boolean(cfg.geminiApiKeyConfigured);
  const anyRealtimeKey = o || g;
  const lr = String(cfg.liveRealtimeProvider ?? "")
    .trim()
    .toLowerCase();
  let selectedProviderHasKey = false;
  if (lr === "openai") {
    selectedProviderHasKey = o;
  } else if (lr === "gemini") {
    selectedProviderHasKey = g;
  }
  return { anyRealtimeKey, selectedProviderHasKey, liveRealtimeProvider: lr };
};

/**
 * @param {string} apiBase
 * @returns {Promise<boolean>}
 */
window.ICFetchInterviewApiEnabled = async function ICFetchInterviewApiEnabled(apiBase) {
  const cfg = await window.ICFetchPublicAppConfig(apiBase);
  if (!cfg || typeof cfg.interviewApiEnabled !== "boolean") {
    return true;
  }
  return cfg.interviewApiEnabled;
};
