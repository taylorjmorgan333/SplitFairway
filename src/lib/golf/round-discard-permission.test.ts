import { describe, expect, it } from "vitest";
import { canDiscardRound } from "./round-discard-permission";

const ME = "11111111-1111-1111-1111-111111111111";
const SOMEONE_ELSE = "22222222-2222-2222-2222-222222222222";

describe("canDiscardRound", () => {
  it("Quick Round: the creator can discard it", () => {
    expect(
      canDiscardRound({ tripKind: "quick_round", roundCreatedBy: ME, currentUserId: ME, isCaptain: true }),
    ).toBe(true);
  });

  it("Quick Round: a non-creator cannot discard it, even if somehow flagged as captain", () => {
    expect(
      canDiscardRound({
        tripKind: "quick_round",
        roundCreatedBy: SOMEONE_ELSE,
        currentUserId: ME,
        isCaptain: true,
      }),
    ).toBe(false);
  });

  it("Quick Round: created_by of null (creator account since deleted) blocks everyone", () => {
    expect(
      canDiscardRound({ tripKind: "quick_round", roundCreatedBy: null, currentUserId: ME, isCaptain: true }),
    ).toBe(false);
  });

  it("Group Round: the trip captain can discard it, regardless of who created the round row", () => {
    expect(
      canDiscardRound({
        tripKind: "group_round",
        roundCreatedBy: SOMEONE_ELSE,
        currentUserId: ME,
        isCaptain: true,
      }),
    ).toBe(true);
  });

  it("Group Round: a non-captain member cannot discard it", () => {
    expect(
      canDiscardRound({ tripKind: "group_round", roundCreatedBy: ME, currentUserId: ME, isCaptain: false }),
    ).toBe(false);
  });

  it("Trip Round: the trip captain can discard it", () => {
    expect(
      canDiscardRound({ tripKind: "trip", roundCreatedBy: SOMEONE_ELSE, currentUserId: ME, isCaptain: true }),
    ).toBe(true);
  });

  it("Trip Round: a non-captain member cannot discard it", () => {
    expect(
      canDiscardRound({ tripKind: "trip", roundCreatedBy: ME, currentUserId: ME, isCaptain: false }),
    ).toBe(false);
  });
});
