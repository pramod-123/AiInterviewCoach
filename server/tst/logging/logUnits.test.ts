import { describe, expect, it } from "vitest";
import { stringCharCount, truncateForLog } from "../../src/logging/logUnits.js";

describe("logUnits", () => {
  describe("stringCharCount", () => {
    it("returns length for strings", () => {
      expect(stringCharCount("abc")).toBe(3);
      expect(stringCharCount("")).toBe(0);
    });
    it("returns 0 for non-strings", () => {
      expect(stringCharCount(null)).toBe(0);
      expect(stringCharCount(undefined)).toBe(0);
      expect(stringCharCount(42)).toBe(0);
      expect(stringCharCount({})).toBe(0);
    });
  });

  describe("truncateForLog", () => {
    it("returns full string when within max", () => {
      expect(truncateForLog("hi", 10)).toBe("hi");
    });
    it("truncates with ellipsis", () => {
      expect(truncateForLog("abcdef", 3)).toBe("abc…");
    });
    it("returns empty for non-string or non-positive max", () => {
      expect(truncateForLog(null, 5)).toBe("");
      expect(truncateForLog("x", 0)).toBe("");
    });
  });
});
