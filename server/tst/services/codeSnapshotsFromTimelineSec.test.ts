import { describe, expect, it } from "vitest";
import { codeSnapshotsFromTimelineSec } from "../../src/services/codeSnapshotsFromTimelineSec.js";

describe("codeSnapshotsFromTimelineSec", () => {
  it("pairs second timestamps and texts into offsetMs rows", () => {
    expect(codeSnapshotsFromTimelineSec([0, 1.5], ["a", "b"])).toEqual([
      { offsetMs: 0, text: "a", sequence: 0 },
      { offsetMs: 1500, text: "b", sequence: 1 },
    ]);
  });

  it("truncates to the shorter array", () => {
    expect(codeSnapshotsFromTimelineSec([2], ["x", "y"])).toEqual([
      { offsetMs: 2000, text: "x", sequence: 0 },
    ]);
  });
});
