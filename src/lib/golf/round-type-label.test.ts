import { describe, expect, it } from "vitest";
import { roundTypeLabel } from "./round-type-label";

describe("roundTypeLabel", () => {
  it("labels a quick_round trip as Quick Round", () => {
    expect(roundTypeLabel("quick_round")).toBe("Quick Round");
  });

  it("labels a group_round trip as Group Round", () => {
    expect(roundTypeLabel("group_round")).toBe("Group Round");
  });

  it("labels a real trip as Trip Round", () => {
    expect(roundTypeLabel("trip")).toBe("Trip Round");
  });
});
