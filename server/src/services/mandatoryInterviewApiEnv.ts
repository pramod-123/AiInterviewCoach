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
      "Interview API requires speech-to-text and evaluation. Speech-to-text uses the local Whisper CLI: set localWhisperExecutable (optional whisperModel) in server/.app-runtime-config.json. Set evaluationProvider, llmProvider, and API keys / model ids in that file (or matching process environment variables).",
    );
  }
}
