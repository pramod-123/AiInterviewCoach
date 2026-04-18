import type { AppEnvResolver } from "../../infrastructure/appEnvResolver.js";
import type { AppPaths } from "../../infrastructure/AppPaths.js";
import { getSpeechToTextProviderMode } from "../../infrastructure/appRuntimeConfig.js";
import { OpenAiLlmClient } from "../llm/OpenAiLlmClient.js";
import type { ISpeechToTextService } from "./ISpeechToTextService.js";
import { LocalWhisperSpeechToTextService } from "./LocalWhisperSpeechToTextService.js";
import { LlmClientSpeechToTextService } from "./LlmClientSpeechToTextService.js";

export type AppPathsResolver = () => AppPaths | null;

/**
 * Selects an {@link ISpeechToTextService} implementation.
 * This build hardcodes {@link getSpeechToTextProviderMode} to **`local`** (Python Whisper CLI); the remote
 * OpenAI path remains for maintenance. Model and executable come from merged env / `.env` (`WHISPER_MODEL`,
 * `LOCAL_WHISPER_*`).
 */
export class SpeechToTextServiceFactory {
  constructor(
    private readonly resolveEnv: AppEnvResolver = () => process.env,
    private readonly resolvePaths: AppPathsResolver = () => null,
  ) {}

  create(): ISpeechToTextService {
    const env = this.resolveEnv();
    const paths = this.resolvePaths();
    const mode = getSpeechToTextProviderMode(paths);
    if (mode === "local") {
      return LocalWhisperSpeechToTextService.create(env);
    }
    const llm = OpenAiLlmClient.tryCreate(env);
    if (!llm) {
      if (!env.OPENAI_API_KEY?.trim()) {
        throw new Error("OPENAI_API_KEY is not set for remote STT.");
      }
      if (!env.OPENAI_MODEL_ID?.trim()) {
        throw new Error("OPENAI_MODEL_ID is not set for remote STT.");
      }
      throw new Error("Could not create OpenAI client for remote STT.");
    }
    return LlmClientSpeechToTextService.create(llm, env);
  }
}
