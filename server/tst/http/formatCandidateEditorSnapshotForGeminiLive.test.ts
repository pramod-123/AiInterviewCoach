import { describe, expect, it } from "vitest";
import { formatCandidateEditorSnapshotForGeminiLive } from "../../src/http/GeminiLiveWebSocketPlugin.js";

describe("formatCandidateEditorSnapshotForGeminiLive", () => {
  it("wraps non-empty code and mentions no video", () => {
    const out = formatCandidateEditorSnapshotForGeminiLive("const x = 1;\n");
    expect(out).toContain("const x = 1;");
    expect(out).toContain("Screen/video frames are not sent");
    expect(out).toContain("plain text");
  });

  it("uses empty placeholder for blank buffer", () => {
    expect(formatCandidateEditorSnapshotForGeminiLive("")).toContain("(empty editor buffer)");
    expect(formatCandidateEditorSnapshotForGeminiLive("   ")).toContain("(empty editor buffer)");
  });

  it("passes through long buffers without server-side truncation", () => {
    const long = `// ${"x".repeat(8000)}\nconst n = 1;\n`;
    const out = formatCandidateEditorSnapshotForGeminiLive(long);
    expect(out).toContain(long);
    expect(out).not.toContain("truncated");
  });
});
