import { describe, expect, it } from "vitest";
import { resolveGuestInvitationStatus } from "./guest-invitation";

const NOW = new Date("2026-09-15T12:00:00Z");

describe("resolveGuestInvitationStatus", () => {
  it("resolves a valid, not-yet-opened invitation as pending", () => {
    expect(
      resolveGuestInvitationStatus({ status: "pending", expiresAt: "2026-09-20T00:00:00Z", now: NOW }),
    ).toBe("pending");
  });

  it("resolves a valid, already-opened invitation as redeemed", () => {
    expect(
      resolveGuestInvitationStatus({ status: "redeemed", expiresAt: "2026-09-20T00:00:00Z", now: NOW }),
    ).toBe("redeemed");
  });

  it("resolves a revoked invitation as revoked regardless of expiry", () => {
    expect(
      resolveGuestInvitationStatus({ status: "revoked", expiresAt: "2099-01-01T00:00:00Z", now: NOW }),
    ).toBe("revoked");
  });

  it("resolves an expired-but-never-redeemed invitation as expired, not pending", () => {
    expect(
      resolveGuestInvitationStatus({ status: "pending", expiresAt: "2026-09-01T00:00:00Z", now: NOW }),
    ).toBe("expired");
  });

  it("resolves an expired-but-already-redeemed invitation as expired -- expiry only blocks NEW/repeat redemption, but the badge should still flag it as no longer renewable", () => {
    expect(
      resolveGuestInvitationStatus({ status: "redeemed", expiresAt: "2026-09-01T00:00:00Z", now: NOW }),
    ).toBe("expired");
  });

  it("treats revoked as taking priority over expiry when both are true", () => {
    expect(
      resolveGuestInvitationStatus({ status: "revoked", expiresAt: "2026-09-01T00:00:00Z", now: NOW }),
    ).toBe("revoked");
  });

  it("treats the exact expiry instant as already expired (matches the SQL's <= now() check)", () => {
    expect(
      resolveGuestInvitationStatus({ status: "pending", expiresAt: NOW, now: NOW }),
    ).toBe("expired");
  });
});
