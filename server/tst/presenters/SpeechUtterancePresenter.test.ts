import type { SpeechUtterance } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { SpeechUtterancePresenter } from "../../src/presenters/SpeechUtterancePresenter.js";

function mockRow(partial: Partial<SpeechUtterance> & Pick<SpeechUtterance, "id">): SpeechUtterance {
  return {
    jobId: "job-1",
    startMs: 0,
    endMs: 1,
    text: "",
    sequence: 0,
    createdAt: new Date("2020-01-01T00:00:00.000Z"),
    ...partial,
  } as SpeechUtterance;
}

describe("SpeechUtterancePresenter", () => {
  it("maps rows to DTOs", () => {
    const rows = [
      mockRow({
        id: "a",
        startMs: 100,
        endMs: 200,
        text: "hello",
        sequence: 1,
      }),
    ];
    const dto = SpeechUtterancePresenter.toDtoList(rows);
    expect(dto).toEqual([
      {
        id: "a",
        startMs: 100,
        endMs: 200,
        text: "hello",
        sequence: 1,
      },
    ]);
  });

  it("defaultOrderBy is stable", () => {
    expect(SpeechUtterancePresenter.defaultOrderBy).toEqual([
      { sequence: "asc" },
      { startMs: "asc" },
    ]);
  });
});
