const DEFAULT = "base";

/**
 * Shared Whisper **model id** for:
 * - local `whisper` CLI ({@link LocalWhisperSpeechToTextService}, semantic diarization)
 * - WhisperX Python (`scripts/diarize_dialogue_whisperx.py` reads the same vars from `process.env`)
 *
 * Precedence: `WHISPER_MODEL` → `LOCAL_WHISPER_MODEL` → `WHISPERX_MODEL` → `"base"`.
 */
export function whisperModelFromEnv(env: NodeJS.ProcessEnv = process.env): string {
  const m =
    env.WHISPER_MODEL?.trim() || env.LOCAL_WHISPER_MODEL?.trim() || env.WHISPERX_MODEL?.trim() || DEFAULT;
  return m || DEFAULT;
}
