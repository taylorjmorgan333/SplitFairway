import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <div>
      <h1 className="text-2xl">Welcome back</h1>
      <p className="mt-1.5 text-sm text-charcoal-500">
        Log in to see your trips and balances.
      </p>
      <div className="mt-7">
        <LoginForm />
      </div>
    </div>
  );
}
