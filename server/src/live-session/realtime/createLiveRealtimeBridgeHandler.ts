import type { IAppDao } from "../../dao/IAppDao.js";
import type { AppPaths } from "../../infrastructure/AppPaths.js";
import { GeminiLiveBridgeHandler } from "./gemini/GeminiLiveBridgeHandler.js";
import { OpenAILiveBridgeHandler } from "./openai/OpenAILiveBridgeHandler.js";
import type { LiveRealtimeBridgeHandler, LiveRealtimeBridgeLogger } from "./LiveRealtimeBridgeHandler.js";

export type CreateLiveRealtimeBridgeResult =
  | { ok: true; handler: LiveRealtimeBridgeHandler }
  | { ok: false; closeCode: number; reason: string };

/**
 * Builds the upstream voice bridge for `/api/live-sessions/:id/realtime` from
 * `LIVE_REALTIME_PROVIDER` (`gemini` default, or `openai`) and related env vars.
 */
export function createLiveRealtimeBridgeHandler(
  sessionId: string,
  db: IAppDao,
  paths: AppPaths,
  log: LiveRealtimeBridgeLogger,
): CreateLiveRealtimeBridgeResult {
  const provider = (process.env.LIVE_REALTIME_PROVIDER ?? "gemini").trim().toLowerCase();

  if (provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return { ok: false, closeCode: 1013, reason: "OPENAI_API_KEY not configured" };
    }
    const model = process.env.OPENAI_REALTIME_MODEL?.trim();
    if (!model) {
      return { ok: false, closeCode: 1013, reason: "OPENAI_REALTIME_MODEL not configured" };
    }
    const voice = process.env.OPENAI_REALTIME_VOICE?.trim() ?? "alloy";
    return {
      ok: true,
      handler: new OpenAILiveBridgeHandler(sessionId, db, paths, model, log, apiKey, voice),
    };
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, closeCode: 1013, reason: "GEMINI_API_KEY not configured" };
  }
  const model = process.env.GEMINI_LIVE_MODEL?.trim();
  if (!model) {
    return { ok: false, closeCode: 1013, reason: "GEMINI_LIVE_MODEL not configured" };
  }
  return {
    ok: true,
    handler: new GeminiLiveBridgeHandler(sessionId, db, paths, model, log, apiKey),
  };
}
