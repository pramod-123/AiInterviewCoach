import type { CodeSnapshot } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { CodeSnapshotPresenter } from "../../src/presenters/CodeSnapshotPresenter.js";

function mockRow(partial: Partial<CodeSnapshot> & Pick<CodeSnapshot, "id">): CodeSnapshot {
  return {
    jobId: "job-1",
    source: "VIDEO_OCR",
    offsetMs: 0,
    text: "",
    sequence: 0,
    createdAt: new Date("2020-01-01T00:00:00.000Z"),
    ...partial,
  } as CodeSnapshot;
}

describe("CodeSnapshotPresenter", () => {
  it("maps rows to DTOs", () => {
    const rows = [
      mockRow({
        id: "b",
        source: "EDITOR_SNAPSHOT",
        offsetMs: 5000,
        text: "int x = 1;",
        sequence: 0,
      }),
    ];
    const dto = CodeSnapshotPresenter.toDtoList(rows);
    expect(dto).toEqual([
      {
        id: "b",
        source: "EDITOR_SNAPSHOT",
        offsetMs: 5000,
        text: "int x = 1;",
        sequence: 0,
      },
    ]);
  });

  it("defaultOrderBy is stable", () => {
    expect(CodeSnapshotPresenter.defaultOrderBy).toEqual([
      { sequence: "asc" },
      { offsetMs: "asc" },
    ]);
  });
});
