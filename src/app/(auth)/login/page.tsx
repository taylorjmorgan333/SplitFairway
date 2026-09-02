import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { isSafeRelativePath } from "@/lib/utils";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const safeNext = isSafeRelativePath(next) ? next : undefined;

  return (
    <div>
      <h1 className="text-2xl">Welcome back</h1>
      <p className="mt-1.5 text-sm text-charcoal-500">
        Log in to see your trips and balances.
      </p>
      <div className="mt-7">
        <LoginForm next={safeNext} />
      </div>
    </div>
  );
}
