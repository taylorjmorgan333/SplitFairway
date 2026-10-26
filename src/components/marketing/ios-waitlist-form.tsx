"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { joinIosWaitlistAction } from "@/actions/ios-waitlist";
import type { ActionState } from "@/actions/auth";
import type { WaitlistSource } from "@/lib/waitlist";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const initialState: ActionState = { status: "idle" };

function SubmitButton({ tone }: { tone: "dark" | "light" }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={tone === "dark" ? "gold" : "primary"}
      disabled={pending}
      className="w-full sm:w-auto"
    >
      {pending ? "Saving…" : "Notify me"}
    </Button>
  );
}

export function IosWaitlistForm({
  source,
  tone,
}: {
  source: WaitlistSource;
  tone: "dark" | "light";
}) {
  const [state, formAction] = useActionState(joinIosWaitlistAction, initialState);
  const dark = tone === "dark";

  return (
    <form action={formAction} className="relative space-y-3">
      <h2 className={cn("text-lg", dark ? "text-cream-50" : "text-forest-900")}>iOS app</h2>
      <p className={cn("text-sm", dark ? "text-cream-100/70" : "text-charcoal-500")}>
        Leave your email and we&apos;ll let you know when the iOS app is ready. No account required.
      </p>
      <input type="hidden" name="source" value={source} />
      <div className="absolute left-[-9999px] h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor={`${source}-website`}>Website</label>
        <input id={`${source}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          aria-label="Email address"
          aria-invalid={Boolean(state.fieldErrors?.email)}
          className="sm:flex-1"
        />
        <SubmitButton tone={tone} />
      </div>
      {state.fieldErrors?.email && (
        <p role="alert" className={cn("text-xs", dark ? "text-gold-300" : "text-red-700")}>
          {state.fieldErrors.email[0]}
        </p>
      )}
      {state.status === "error" && state.message && (
        <p role="alert" className={cn("text-sm", dark ? "text-gold-300" : "text-red-700")}>
          {state.message}
        </p>
      )}
      {state.status === "success" && state.message && (
        <p role="status" className={cn("text-sm", dark ? "text-gold-300" : "text-forest-800")}>
          {state.message}
        </p>
      )}
    </form>
  );
}
