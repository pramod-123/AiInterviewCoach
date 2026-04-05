import type { SrtGenerationResult } from "../../types/srtGeneration.js";

/** Non-negative gap between two closed intervals on the timeline; 0 if they overlap or touch. */
function intervalGapMs(a0: number, a1: number, b0: number, b1: number): number {
  if (a1 < b0) {
    return b0 - a1;
  }
  if (b1 < a0) {
    return a0 - b1;
  }
  return 0;
}

/**
 * Picks the diarization segment speaker with the largest time overlap with [startMs, endMs].
 * When overlap is 0 (common if primary STT and diarization used different Whisper passes or
 * tab/mic vs dialogue-mixed audio), falls back to the diarization interval with the smallest
 * temporal gap to the STT window so labels are still attached.
 */
export function speakerLabelForInterval(
  startMs: number,
  endMs: number,
  diarization: SrtGenerationResult | undefined,
): string | null {
  if (!diarization?.segments.length) {
    return null;
  }
  let bestLabel: string | null = null;
  let bestOverlap = 0;
  for (const d of diarization.segments) {
    const overlap = Math.max(0, Math.min(endMs, d.endMs) - Math.max(startMs, d.startMs));
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestLabel = d.speakerLabel;
    }
  }
  if (bestOverlap > 0) {
    return bestLabel;
  }

  let nearestLabel: string | null = null;
  let nearestGap = Number.POSITIVE_INFINITY;
  for (const d of diarization.segments) {
    const gap = intervalGapMs(startMs, endMs, d.startMs, d.endMs);
    if (gap < nearestGap) {
      nearestGap = gap;
      nearestLabel = d.speakerLabel;
    }
  }
  return nearestLabel;
}
