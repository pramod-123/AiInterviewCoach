import fs from "node:fs";
import fsp from "node:fs/promises";
import type { AppPaths } from "./AppPaths.js";

/** On-disk shape under {@link AppPaths.runtimeAppConfigPath}. */
export type AppRuntimeConfigV1 = {
  version: 1;
  liveRealtimeProvider?: string;
  openaiApiKey?: string;
  geminiApiKey?: string;
  anthropicApiKey?: string;
  openaiRealtimeModel?: string;
  openaiRealtimeVoice?: string;
  geminiLiveModel?: string;
  llmProvider?: string;
  openaiModelId?: string;
  anthropicModelId?: string;
  geminiModelId?: string;
  /** Local Whisper CLI checkpoint id; merged as `WHISPER_MODEL` when set. */
  whisperModel?: string;
};

/** GET `/api/app-config` — no raw secrets. */
export type AppRuntimeConfigPublicV1 = {
  version: 1;
  liveRealtimeProvider: string;
  openaiRealtimeModel: string;
  openaiRealtimeVoice: string;
  geminiLiveModel: string;
  llmProvider: string;
  openaiModelId: string;
  anthropicModelId: string;
  geminiModelId: string;
  openaiApiKeyConfigured: boolean;
  geminiApiKeyConfigured: boolean;
  anthropicApiKeyConfigured: boolean;
  whisperModel: string;
};

const PATCH_KEYS = new Set([
  "liveRealtimeProvider",
  "openaiApiKey",
  "geminiApiKey",
  "anthropicApiKey",
  "openaiRealtimeModel",
  "openaiRealtimeVoice",
  "geminiLiveModel",
  "llmProvider",
  "openaiModelId",
  "anthropicModelId",
  "geminiModelId",
  "whisperModel",
]);

let mergedEnvCache: { mtimeMs: number; env: NodeJS.ProcessEnv } | null = null;

export function invalidateRuntimeAppConfigEnvCache(): void {
  mergedEnvCache = null;
}

export function readRuntimeAppConfigSync(paths: AppPaths): AppRuntimeConfigV1 | null {
  const p = paths.runtimeAppConfigPath();
  try {
    const raw = fs.readFileSync(p, "utf-8");
    const o = JSON.parse(raw) as AppRuntimeConfigV1;
    if (o && o.version === 1) {
      return o;
    }
  } catch {
    /* missing or invalid */
  }
  return null;
}

export function toPublicRuntimeConfig(cfg: AppRuntimeConfigV1 | null): AppRuntimeConfigPublicV1 {
  const c = cfg ?? { version: 1 };
  return {
    version: 1,
    liveRealtimeProvider: (c.liveRealtimeProvider ?? "").trim(),
    openaiRealtimeModel: (c.openaiRealtimeModel ?? "").trim(),
    openaiRealtimeVoice: (c.openaiRealtimeVoice ?? "").trim(),
    geminiLiveModel: (c.geminiLiveModel ?? "").trim(),
    llmProvider: (c.llmProvider ?? "").trim(),
    openaiModelId: (c.openaiModelId ?? "").trim(),
    anthropicModelId: (c.anthropicModelId ?? "").trim(),
    geminiModelId: (c.geminiModelId ?? "").trim(),
    openaiApiKeyConfigured: Boolean(c.openaiApiKey?.trim()),
    geminiApiKeyConfigured: Boolean(c.geminiApiKey?.trim()),
    anthropicApiKeyConfigured: Boolean(c.anthropicApiKey?.trim()),
    whisperModel: (c.whisperModel ?? "").trim(),
  };
}

/** Common `openai-whisper` checkpoint ids accepted by the Server config API. */
export const WHISPER_MODEL_PRESETS = [
  "tiny",
  "base",
  "small",
  "medium",
  "large",
  "large-v2",
  "large-v3",
  "turbo",
] as const;

const WHISPER_MODEL_ID_RE = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

export function isAllowedWhisperModelId(raw: string): boolean {
  const t = raw.trim().toLowerCase();
  if (!t || t.length > 64) {
    return false;
  }
  if ((WHISPER_MODEL_PRESETS as readonly string[]).includes(t)) {
    return true;
  }
  return WHISPER_MODEL_ID_RE.test(t);
}

/**
 * Speech-to-text backend mode. This build **always** uses the local Whisper CLI (`"local"`).
 * The `"remote"` branch remains in {@link SpeechToTextServiceFactory} for reference.
 */
export function getSpeechToTextProviderMode(_paths: AppPaths | null): "local" | "remote" {
  return "local";
}

/**
 * `process.env` plus non-empty overrides from `app-runtime-config.json` (mtime-cached).
 * Used for live realtime bridge, LLM evaluation, and Whisper model override.
 */
export function getMergedAppEnv(paths: AppPaths): NodeJS.ProcessEnv {
  const p = paths.runtimeAppConfigPath();
  try {
    const st = fs.statSync(p);
    if (mergedEnvCache && mergedEnvCache.mtimeMs === st.mtimeMs) {
      return mergedEnvCache.env;
    }
    const file = readRuntimeAppConfigSync(paths);
    const base = { ...process.env } as Record<string, string | undefined>;
    const set = (envKey: string, fileVal: string | undefined) => {
      if (typeof fileVal !== "string") {
        return;
      }
      const t = fileVal.trim();
      if (!t) {
        return;
      }
      base[envKey] = t;
    };
    if (file) {
      set("LIVE_REALTIME_PROVIDER", file.liveRealtimeProvider);
      set("OPENAI_API_KEY", file.openaiApiKey);
      set("GEMINI_API_KEY", file.geminiApiKey);
      set("ANTHROPIC_API_KEY", file.anthropicApiKey);
      set("OPENAI_REALTIME_MODEL", file.openaiRealtimeModel);
      set("OPENAI_REALTIME_VOICE", file.openaiRealtimeVoice);
      set("GEMINI_LIVE_MODEL", file.geminiLiveModel);
      set("LLM_PROVIDER", file.llmProvider);
      set("OPENAI_MODEL_ID", file.openaiModelId);
      set("ANTHROPIC_MODEL_ID", file.anthropicModelId);
      set("GEMINI_MODEL_ID", file.geminiModelId);
      set("WHISPER_MODEL", file.whisperModel);
    }
    const env = base as NodeJS.ProcessEnv;
    mergedEnvCache = { mtimeMs: st.mtimeMs, env };
    return env;
  } catch {
    mergedEnvCache = null;
    return process.env;
  }
}

/**
 * Merge JSON patch into the runtime config file. Empty string removes that field (fall back to `.env`).
 * Unknown keys are ignored. `version` is forced to 1.
 */
export async function patchRuntimeAppConfig(
  paths: AppPaths,
  patch: Record<string, unknown>,
): Promise<AppRuntimeConfigV1> {
  const current = readRuntimeAppConfigSync(paths) ?? { version: 1 };
  const next: AppRuntimeConfigV1 = { ...current, version: 1 };

  for (const [k, v] of Object.entries(patch)) {
    if (k === "version" || !PATCH_KEYS.has(k)) {
      continue;
    }
    if (v === undefined) {
      continue;
    }
    if (v === null) {
      delete (next as Record<string, unknown>)[k];
      continue;
    }
    if (typeof v !== "string") {
      continue;
    }
    if (v.trim() === "") {
      delete (next as Record<string, unknown>)[k];
    } else {
      (next as Record<string, unknown>)[k] = v.trim();
    }
  }

  if (next.liveRealtimeProvider) {
    next.liveRealtimeProvider = next.liveRealtimeProvider.trim().toLowerCase();
  }
  if (next.llmProvider) {
    next.llmProvider = next.llmProvider.trim().toLowerCase();
  }
  if (next.whisperModel) {
    next.whisperModel = next.whisperModel.trim().toLowerCase();
  }

  await fsp.mkdir(paths.dataDir, { recursive: true });
  const outPath = paths.runtimeAppConfigPath();
  const tmp = `${outPath}.${process.pid}.tmp`;
  await fsp.writeFile(tmp, `${JSON.stringify(next, null, 2)}\n`, "utf-8");
  await fsp.rename(tmp, outPath);
  invalidateRuntimeAppConfigEnvCache();
  return next;
}
