import { describe, expect, it } from "vitest";
import { whisperModelFromEnv } from "../../src/services/speech-to-text/whisperModelFromEnv.js";

describe("whisperModelFromEnv", () => {
  it("prefers WHISPER_MODEL", () => {
    expect(
      whisperModelFromEnv({
        WHISPER_MODEL: "small",
        LOCAL_WHISPER_MODEL: "base",
        WHISPERX_MODEL: "tiny",
      }),
    ).toBe("small");
  });

  it("falls back to LOCAL_WHISPER_MODEL then WHISPERX_MODEL then base", () => {
    expect(whisperModelFromEnv({ LOCAL_WHISPER_MODEL: "medium" })).toBe("medium");
    expect(whisperModelFromEnv({ WHISPERX_MODEL: "large" })).toBe("large");
    expect(whisperModelFromEnv({})).toBe("base");
  });
});
