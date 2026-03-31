import type { SpeechUtterance } from "@prisma/client";

export type SpeechUtteranceDto = {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  sequence: number;
};

/**
 * Maps persisted {@link SpeechUtterance} rows (STT windows) to API responses.
 */
export class SpeechUtterancePresenter {
  static readonly defaultOrderBy = [
    { sequence: "asc" as const },
    { startMs: "asc" as const },
  ];

  static toDtoList(rows: SpeechUtterance[]): SpeechUtteranceDto[] {
    return rows.map((s) => ({
      id: s.id,
      startMs: s.startMs,
      endMs: s.endMs,
      text: s.text,
      sequence: s.sequence,
    }));
  }
}
