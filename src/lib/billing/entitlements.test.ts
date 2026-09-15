import { describe, expect, it } from "vitest";
import { computeEntitlements } from "./entitlements";

describe("computeEntitlements", () => {
  it("grants full access to every plan while billing is disabled (beta)", () => {
    expect(computeEntitlements(false)).toEqual({
      hasOrganizerPro: true,
      hasTripPass: true,
      isBetaAccess: true,
    });
  });

  it("grants full beta access regardless of scope while billing is disabled", () => {
    expect(computeEntitlements(false, { groupId: "group-1" })).toEqual({
      hasOrganizerPro: true,
      hasTripPass: true,
      isBetaAccess: true,
    });
    expect(computeEntitlements(false, { tripId: "trip-1" })).toEqual({
      hasOrganizerPro: true,
      hasTripPass: true,
      isBetaAccess: true,
    });
  });

  it("denies paid access once billing is enabled with no subscription/pass data source wired yet", () => {
    expect(computeEntitlements(true)).toEqual({
      hasOrganizerPro: false,
      hasTripPass: false,
      isBetaAccess: false,
    });
  });

  it("does not grant beta access once billing is enabled", () => {
    const result = computeEntitlements(true, { groupId: "group-1", tripId: "trip-1" });
    expect(result.isBetaAccess).toBe(false);
  });
});
