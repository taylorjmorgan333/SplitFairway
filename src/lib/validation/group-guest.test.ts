import { describe, expect, it } from "vitest";
import { createGuestInvitationSchema } from "./group";

describe("createGuestInvitationSchema", () => {
  it("accepts a normal guest name", () => {
    const result = createGuestInvitationSchema.safeParse({ guestDisplayName: "Steve" });
    expect(result.success).toBe(true);
  });

  it("accepts a blank name -- the RPC falls back to the literal name 'Guest'", () => {
    const result = createGuestInvitationSchema.safeParse({ guestDisplayName: "" });
    expect(result.success).toBe(true);
  });

  it("accepts an omitted name", () => {
    const result = createGuestInvitationSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("rejects a name over 60 characters, matching the RPC's own limit", () => {
    const result = createGuestInvitationSchema.safeParse({ guestDisplayName: "a".repeat(61) });
    expect(result.success).toBe(false);
  });

  it("accepts a name at exactly the 60-character limit", () => {
    const result = createGuestInvitationSchema.safeParse({ guestDisplayName: "a".repeat(60) });
    expect(result.success).toBe(true);
  });
});
