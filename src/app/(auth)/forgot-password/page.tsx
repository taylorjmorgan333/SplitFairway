import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <div>
      <h1 className="text-2xl">Reset your password</h1>
      <p className="mt-1.5 text-sm text-charcoal-500">
        We&apos;ll email you a link to choose a new one.
      </p>
      <div className="mt-7">
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
