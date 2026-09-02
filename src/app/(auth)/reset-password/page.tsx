import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <div>
      <h1 className="text-2xl">Choose a new password</h1>
      <p className="mt-1.5 text-sm text-charcoal-500">
        This link only works if you just opened it from your reset email.
      </p>
      <div className="mt-7">
        <ResetPasswordForm />
      </div>
    </div>
  );
}
