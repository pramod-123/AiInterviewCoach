import type { CodeSnapshot } from "@prisma/client";

export type CodeSnapshotDto = {
  id: string;
  source: CodeSnapshot["source"];
  offsetMs: number;
  text: string;
  sequence: number;
};

/**
 * Maps persisted {@link CodeSnapshot} rows (OCR / editor captures) to API responses.
 */
export class CodeSnapshotPresenter {
  static readonly defaultOrderBy = [
    { sequence: "asc" as const },
    { offsetMs: "asc" as const },
  ];

  static toDtoList(rows: CodeSnapshot[]): CodeSnapshotDto[] {
    return rows.map((r) => ({
      id: r.id,
      source: r.source,
      offsetMs: r.offsetMs,
      text: r.text,
      sequence: r.sequence,
    }));
  }
}
