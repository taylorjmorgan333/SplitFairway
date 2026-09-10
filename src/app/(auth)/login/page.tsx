import type { Metadata } from "next";
import { headers } from "next/headers";
import { LoginForm } from "@/components/auth/login-form";
import { NativeSessionRecovery } from "@/components/auth/native-session-recovery";
import { isNativeAppUserAgent } from "@/lib/native-app";
import { isSafeRelativePath } from "@/lib/utils";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const safeNext = isSafeRelativePath(next) ? next : undefined;

  const userAgent = (await headers()).get("user-agent") ?? "";
  const isNativeApp = isNativeAppUserAgent(userAgent);

  // Worth hiding the form for (see NativeSessionRecovery) only when
  // this /login visit resulted from being bounced off a protected
  // route -- middleware.ts appends `next` in exactly that case. A
  // direct visit (tapping "Log in" from the marketing header, no
  // `next`) shows the form immediately, identically to the web.
  const shouldAttemptRecovery = isNativeApp && Boolean(safeNext);

  return (
    <NativeSessionRecovery next={safeNext} shouldAttemptRecovery={shouldAttemptRecovery}>
      <h1 className="text-2xl">Welcome back</h1>
      <p className="mt-1.5 text-sm text-charcoal-500">
        Log in to see your trips and balances.
      </p>
      <div className="mt-7">
        <LoginForm next={safeNext} />
      </div>
    </NativeSessionRecovery>
  );
}
