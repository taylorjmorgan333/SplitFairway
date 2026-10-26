import { describe, expect, it } from "vitest";
import { classifyWaitlistSubmission, waitlistMigrationMissing } from "@/lib/waitlist";

describe("classifyWaitlistSubmission", () => {
  it("accepts a footer or trip-mode email", () => {
    expect(
      classifyWaitlistSubmission({
        email: " Golfer@Example.com ",
        website: "",
        source: "home_footer",
      }),
    ).toEqual({ ok: true, email: "golfer@example.com", source: "home_footer" });
  });

  it("treats a filled honeypot as spam", () => {
    expect(
      classifyWaitlistSubmission({
        email: "golfer@example.com",
        website: "https://spam.example",
        source: "trip_mode",
      }),
    ).toEqual({ ok: false, reason: "spam" });
  });

  it("rejects a bad email or an unknown source", () => {
    expect(
      classifyWaitlistSubmission({ email: "nope", website: "", source: "home_footer" }).ok,
    ).toBe(false);
    expect(
      classifyWaitlistSubmission({ email: "a@b.co", website: "", source: "other" }).ok,
    ).toBe(false);
  });
});

describe("waitlistMigrationMissing", () => {
  it("recognizes a function that has not been created yet", () => {
    expect(waitlistMigrationMissing("Could not find the function public.join_ios_waitlist")).toBe(true);
    expect(waitlistMigrationMissing("permission denied")).toBe(false);
  });
});
