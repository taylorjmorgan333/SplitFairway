import { describe, expect, it } from "vitest";
import {
  firstMatchingInvite,
  invitePath,
  isStoredInviteToken,
} from "@/lib/join/resolve-invite";

const TOKEN = "a".repeat(64);

describe("join codes", () => {
  it("accepts only the 64-character hex tokens invitations actually use", () => {
    expect(isStoredInviteToken(TOKEN)).toBe(true);
    expect(isStoredInviteToken(TOKEN.toUpperCase())).toBe(true);
    expect(isStoredInviteToken("AUGUST")).toBe(false);
    expect(isStoredInviteToken(`${TOKEN}aa`)).toBe(false);
  });

  it("sends each kind to the invite page that already accepts it", () => {
    expect(invitePath("trip", TOKEN)).toBe(`/invite/${TOKEN}`);
    expect(invitePath("group", TOKEN)).toBe(`/invite/group/${TOKEN}`);
    expect(invitePath("guest", TOKEN)).toBe(`/invite/guest/${TOKEN}`);
  });

  it("ignores not_found and picks the first real invitation", () => {
    expect(
      firstMatchingInvite({
        trip: { status: "not_found" },
        group: { status: "pending" },
        guest: { status: "pending" },
      }),
    ).toBe("group");
    expect(
      firstMatchingInvite({
        trip: { status: "not_found" },
        group: null,
        guest: { status: "expired" },
      }),
    ).toBe("guest");
    expect(
      firstMatchingInvite({
        trip: { status: "not_found" },
        group: { status: "not_found" },
        guest: { status: "not_found" },
      }),
    ).toBeNull();
  });
});
