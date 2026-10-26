import { describe, expect, it } from "vitest";
import { signUpSchema } from "@/lib/validation/auth";

const base = {
  fullName: "Taylor Morgan",
  email: "taylor@example.com",
  password: "fairway1",
};

describe("signUpSchema", () => {
  it("accepts a signup that does not repeat the password", () => {
    expect(signUpSchema.safeParse(base).success).toBe(true);
  });

  it("still rejects a confirm-password value that does not match", () => {
    const parsed = signUpSchema.safeParse({ ...base, confirmPassword: "different" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.flatten().fieldErrors.confirmPassword?.[0]).toBe("Passwords don't match");
    }
  });

  it("accepts a matching confirm-password when a caller still sends one", () => {
    expect(signUpSchema.safeParse({ ...base, confirmPassword: base.password }).success).toBe(true);
  });
});
