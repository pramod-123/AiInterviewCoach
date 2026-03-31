/**
 * Pairs parallel arrays of timestamps (seconds on the interview timeline) and code/OCR strings
 * into `{ offsetMs, text, sequence }` rows for {@link CodeSnapshot} persistence (one instant per sample).
 */
export function codeSnapshotsFromTimelineSec(
  timesSec: number[],
  texts: string[],
): Array<{ offsetMs: number; text: string; sequence: number }> {
  const n = Math.min(timesSec.length, texts.length);
  const rows: Array<{ offsetMs: number; text: string; sequence: number }> = [];
  for (let i = 0; i < n; i++) {
    rows.push({
      offsetMs: Math.max(0, Math.round(timesSec[i]! * 1000)),
      text: texts[i] ?? "",
      sequence: i,
    });
  }
  return rows;
}
