import { describe, expect, it } from "vitest";
import { splitEqually, validateCustomSplit, equalSplitMethod } from "./split";

describe("splitEqually", () => {
  it("splits with no remainder evenly across every member", () => {
    // $100.00 across 4 golfers divides perfectly: $25.00 each.
    const shares = splitEqually(10000, ["d", "b", "c", "a"]);
    expect(shares).toHaveLength(4);
    expect(shares.every((s) => s.amountOwedCents === 2500)).toBe(true);
    expect(shares.reduce((sum, s) => sum + s.amountOwedCents, 0)).toBe(10000);
  });

  it("distributes a one-cent remainder deterministically", () => {
    // $100.00 across 3 golfers: $33.33, $33.33, $33.34 — one member
    // gets the extra cent so the total is exact.
    const shares = splitEqually(10000, ["mike", "chris", "taylor"]);
    const sum = shares.reduce((total, s) => total + s.amountOwedCents, 0);
    expect(sum).toBe(10000);

    const amounts = shares.map((s) => s.amountOwedCents).sort((a, b) => a - b);
    expect(amounts).toEqual([3333, 3333, 3334]);

    // Sorted by member ID ascending, so "chris" < "mike" < "taylor" —
    // "chris" gets the extra cent.
    const byId = new Map(shares.map((s) => [s.tripMemberId, s.amountOwedCents]));
    expect(byId.get("chris")).toBe(3334);
    expect(byId.get("mike")).toBe(3333);
    expect(byId.get("taylor")).toBe(3333);
  });

  it("is deterministic regardless of the input order (selection order doesn't matter)", () => {
    const a = splitEqually(10001, ["taylor", "mike", "chris"]);
    const b = splitEqually(10001, ["chris", "taylor", "mike"]);
    const normalize = (shares: typeof a) =>
      [...shares].sort((x, y) => x.tripMemberId.localeCompare(y.tripMemberId));
    expect(normalize(a)).toEqual(normalize(b));
  });

  it("supports splitting among only a selected subset of members", () => {
    // Selected-member split: only 2 of the trip's golfers are in this one.
    const shares = splitEqually(5000, ["mike", "chris"]);
    expect(shares).toHaveLength(2);
    expect(shares.reduce((sum, s) => sum + s.amountOwedCents, 0)).toBe(5000);
  });

  it("rejects an empty member list", () => {
    expect(() => splitEqually(1000, [])).toThrow();
  });

  it("rejects a non-positive total", () => {
    expect(() => splitEqually(0, ["a"])).toThrow();
    expect(() => splitEqually(-500, ["a"])).toThrow();
  });
});

describe("validateCustomSplit", () => {
  it("accepts a custom split whose shares sum exactly to the total", () => {
    const result = validateCustomSplit(10000, [
      { tripMemberId: "mike", amountOwedCents: 4000 },
      { tripMemberId: "chris", amountOwedCents: 6000 },
    ]);
    expect(result).toEqual({ valid: true });
  });

  it("rejects a custom split whose shares don't sum to the total", () => {
    const result = validateCustomSplit(10000, [
      { tripMemberId: "mike", amountOwedCents: 4000 },
      { tripMemberId: "chris", amountOwedCents: 5000 },
    ]);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toMatch(/match exactly/i);
    }
  });

  it("rejects a custom split with a zero or negative share", () => {
    const result = validateCustomSplit(10000, [
      { tripMemberId: "mike", amountOwedCents: 10000 },
      { tripMemberId: "chris", amountOwedCents: 0 },
    ]);
    expect(result.valid).toBe(false);
  });

  it("rejects an empty custom split", () => {
    expect(validateCustomSplit(10000, [])).toEqual({
      valid: false,
      error: "Select at least one golfer to split this with.",
    });
  });

  it("rejects a duplicate member in the same split", () => {
    const result = validateCustomSplit(10000, [
      { tripMemberId: "mike", amountOwedCents: 5000 },
      { tripMemberId: "mike", amountOwedCents: 5000 },
    ]);
    expect(result.valid).toBe(false);
  });
});

describe("equalSplitMethod", () => {
  it("labels a split covering every active member as 'equal'", () => {
    expect(equalSplitMethod(["a", "b", "c"], 3)).toBe("equal");
  });

  it("labels a split covering a subset of members as 'selected'", () => {
    expect(equalSplitMethod(["a", "b"], 3)).toBe("selected");
  });
});
