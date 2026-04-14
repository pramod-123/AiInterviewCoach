import { describe, expect, it } from "vitest";
import { summarizeGeminiLiveClientPayloadsForLog } from "../../src/logging/geminiLiveLogUtils.js";

describe("summarizeGeminiLiveClientPayloadsForLog", () => {
  it("passes through payloads unchanged (shallow copy)", () => {
    const audio = { type: "modelAudio", mimeType: "audio/pcm;rate=24000", data: "a".repeat(100) };
    const out = summarizeGeminiLiveClientPayloadsForLog([audio]);
    expect(out).toEqual([audio]);
    expect(out[0]).not.toBe(audio);
  });

  it("passes through modelThought with full text", () => {
    expect(summarizeGeminiLiveClientPayloadsForLog([{ type: "modelThought", text: "abc" }])).toEqual([
      { type: "modelThought", text: "abc" },
    ]);
  });

  it("passes through modelText and transcriptions with full text", () => {
    expect(
      summarizeGeminiLiveClientPayloadsForLog([
        { type: "modelText", text: "hello" },
        { type: "inputTranscription", text: "yo", finished: true },
        { type: "outputTranscription", text: "there", finished: false },
      ]),
    ).toEqual([
      { type: "modelText", text: "hello" },
      { type: "inputTranscription", text: "yo", finished: true },
      { type: "outputTranscription", text: "there", finished: false },
    ]);
  });

  it("passes through sessionResumptionUpdate fields", () => {
    expect(
      summarizeGeminiLiveClientPayloadsForLog([
        {
          type: "sessionResumptionUpdate",
          resumable: true,
          lastConsumedClientMessageIndex: "7",
        },
      ]),
    ).toEqual([
      {
        type: "sessionResumptionUpdate",
        resumable: true,
        lastConsumedClientMessageIndex: "7",
      },
    ]);
  });

  it("passes through unknown payload kinds", () => {
    expect(summarizeGeminiLiveClientPayloadsForLog([{ type: "ready" }])).toEqual([{ type: "ready" }]);
  });
});
