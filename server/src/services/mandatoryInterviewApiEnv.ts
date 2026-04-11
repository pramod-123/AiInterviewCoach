import { execSync } from "node:child_process";
import type { SpeechTranscriptionEvaluationOrchestrator } from "./SpeechTranscriptionEvaluationOrchestrator.js";

/**
 * ffmpeg/ffprobe on PATH — used for live-session recording merge, audio extract, and Gemini stitch.
 */
export function assertMandatoryFfmpegBinaries(): void {
  try {
    execSync("ffmpeg -version", { stdio: "pipe" });
    execSync("ffprobe -version", { stdio: "pipe" });
  } catch {
    throw new Error(
      "Interview API requires ffmpeg and ffprobe on PATH (live session recording and post-process).",
    );
  }
}

/**
 * @throws If the HTTP API cannot run speech-to-text and evaluation for live sessions.
 */
export function assertMandatoryInterviewApiConfig(
  speechAnalysis: SpeechTranscriptionEvaluationOrchestrator | null,
): asserts speechAnalysis is SpeechTranscriptionEvaluationOrchestrator {
  assertMandatoryFfmpegBinaries();

  if (!speechAnalysis) {
    throw new Error(
      "Interview API requires speech-to-text and evaluation. Set STT_PROVIDER=remote or local (not none), EVALUATION_PROVIDER=llm|single-agent, and LLM_PROVIDER=openai|anthropic with matching API keys. For remote STT or OpenAI LLM: OPENAI_API_KEY and OPENAI_MODEL_ID. For Anthropic LLM: ANTHROPIC_API_KEY and ANTHROPIC_MODEL_ID. Remote Whisper uses whisper-1 in code.",
    );
  }
}
