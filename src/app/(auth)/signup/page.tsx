import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = { title: "Create your account" };

export default function SignupPage() {
  return (
    <div>
      <h1 className="text-2xl">Create your account</h1>
      <p className="mt-1.5 text-sm text-charcoal-500">
        Set up your trip in a few minutes.
      </p>
      <div className="mt-7">
        <SignupForm />
      </div>
    </div>
  );
}
