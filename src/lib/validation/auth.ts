import { z } from "zod";

const email = z
  .string()
  .trim()
  .min(1, "Email is required")
  .email("Enter a valid email address");

const password = z
  .string()
  .min(8, "Password must be at least 8 characters");

export const signUpSchema = z
  .object({
    fullName: z.string().trim().min(1, "Name is required").max(120),
    email,
    password,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export type SignUpInput = z.infer<typeof signUpSchema>;

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email,
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// Two independent proofs of deliberate intent, matched separately so the
// error can point at exactly which one was wrong: the account's current
// password (re-authentication) and a typed literal "DELETE" (so this can
// never be triggered by a stray double-click or a pre-filled form).
export const deleteAccountSchema = z.object({
  password: z.string().min(1, "Enter your current password"),
  confirmation: z
    .string()
    .refine((val) => val === "DELETE", { message: 'Type "DELETE" to confirm' }),
});

export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
