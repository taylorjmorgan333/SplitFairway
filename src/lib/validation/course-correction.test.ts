import { describe, expect, it } from "vitest";
import { courseCorrectionSchema } from "./course-correction";

describe("courseCorrectionSchema", () => {
  it("accepts a minimal valid submission (issueType + reason only)", () => {
    const result = courseCorrectionSchema.safeParse({
      issueType: "wrong_par",
      reason: "Hole 4 is listed as a par 5 but it's a par 4.",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.holeNumber).toBeNull();
      expect(result.data.currentValue).toBeNull();
      expect(result.data.proposedValue).toBeNull();
    }
  });

  it("coerces a numeric-string holeNumber and enforces the 1-18 range", () => {
    const ok = courseCorrectionSchema.safeParse({
      issueType: "wrong_yardage",
      holeNumber: "9",
      reason: "Yardage looks off.",
    });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.holeNumber).toBe(9);

    const tooHigh = courseCorrectionSchema.safeParse({
      issueType: "wrong_yardage",
      holeNumber: "19",
      reason: "Yardage looks off.",
    });
    expect(tooHigh.success).toBe(false);

    const tooLow = courseCorrectionSchema.safeParse({
      issueType: "wrong_yardage",
      holeNumber: "0",
      reason: "Yardage looks off.",
    });
    expect(tooLow.success).toBe(false);
  });

  it("normalizes an empty-string holeNumber/currentValue/proposedValue to null rather than 0 or ''", () => {
    const result = courseCorrectionSchema.safeParse({
      issueType: "wrong_tee_name",
      holeNumber: "",
      currentValue: "",
      proposedValue: "",
      reason: "Tee name is misspelled.",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.holeNumber).toBeNull();
      expect(result.data.currentValue).toBeNull();
      expect(result.data.proposedValue).toBeNull();
    }
  });

  it("trims currentValue/proposedValue and preserves real content", () => {
    const result = courseCorrectionSchema.safeParse({
      issueType: "wrong_stroke_index",
      currentValue: "  3  ",
      proposedValue: "  7  ",
      reason: "Stroke index swapped with hole 7.",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currentValue).toBe("3");
      expect(result.data.proposedValue).toBe("7");
    }
  });

  it("rejects an empty or missing reason", () => {
    const empty = courseCorrectionSchema.safeParse({
      issueType: "other",
      reason: "   ",
    });
    expect(empty.success).toBe(false);

    const missing = courseCorrectionSchema.safeParse({
      issueType: "other",
    });
    expect(missing.success).toBe(false);
  });

  it("rejects a reason over 500 characters", () => {
    const result = courseCorrectionSchema.safeParse({
      issueType: "other",
      reason: "x".repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it("rejects an issueType outside the documented enum", () => {
    const result = courseCorrectionSchema.safeParse({
      issueType: "made_up_reason",
      reason: "This should fail.",
    });
    expect(result.success).toBe(false);
  });
});
