"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { usePathname } from "next/navigation";
import { MessageSquarePlus, X } from "lucide-react";
import { submitFeedbackAction } from "@/actions/feedback";
import type { ActionState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

const initialState: ActionState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending} className="w-full">
      {pending ? "Sending…" : "Send feedback"}
    </Button>
  );
}

/**
 * A small, always-available way for private-beta testers to send
 * feedback without leaving the app. Never shown on the public marketing
 * pages or auth screens — only once someone is inside the product,
 * where feedback is actually about something they're looking at.
 */
export function FeedbackButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const boundAction = submitFeedbackAction.bind(null, pathname ?? "/", null);
  const [state, formAction] = useActionState(boundAction, initialState);

  useEffect(() => {
    if (state.status === "success") {
      const timeout = setTimeout(() => setOpen(false), 1600);
      return () => clearTimeout(timeout);
    }
  }, [state.status]);

  // Keep the button off the public marketing/auth surfaces — feedback
  // there has nowhere useful to attach and the CTAs already crowd those
  // pages. Everything under the authenticated app and trip pages keeps it.
  const hidden =
    pathname === "/" ||
    pathname?.startsWith("/login") ||
    pathname?.startsWith("/signup") ||
    pathname?.startsWith("/forgot-password") ||
    pathname?.startsWith("/reset-password") ||
    pathname?.startsWith("/invite/") ||
    pathname?.startsWith("/legal") ||
    pathname === "/contact";

  if (hidden) return null;

  return (
    // Below md the app shell adds a fixed bottom tab bar, so this floats
    // above it (4.75rem clears the tab bar's own height + safe area);
    // from md up there's no tab bar, so it drops back to a small fixed gap.
    <div className="fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-50 sm:right-6 md:bottom-6">
      {open && (
        <div className="mb-3 w-[calc(100vw-2rem)] max-w-sm rounded-2xl border border-forest-900/[0.08] bg-white p-4 shadow-card-hover">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-base text-forest-900">Send feedback</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close feedback form"
              className="flex h-11 w-11 items-center justify-center rounded-full text-charcoal-400 hover:bg-cream-100"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <p className="mt-1 text-xs text-charcoal-400">
            We&apos;re in private beta — bug reports, confusing screens, missing features, all
            welcome.
          </p>

          <form action={formAction} className="mt-3 space-y-3">
            {state.status === "error" && state.message && (
              <Alert variant="error">{state.message}</Alert>
            )}
            {state.status === "success" && state.message && (
              <Alert variant="success">{state.message}</Alert>
            )}
            <label htmlFor="feedback-message" className="sr-only">
              Your feedback
            </label>
            <textarea
              id="feedback-message"
              name="message"
              rows={4}
              required
              maxLength={4000}
              placeholder="What's going well, what's confusing, what's broken…"
              className="w-full rounded-lg border border-charcoal-400/25 bg-white px-3.5 py-2.5 text-base text-charcoal placeholder:text-charcoal-400 transition-colors focus:border-forest-600 sm:text-sm"
            />
            {state.fieldErrors?.message && (
              <p className="text-xs text-red-600">{state.fieldErrors.message[0]}</p>
            )}
            <SubmitButton />
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex h-12 items-center gap-2 rounded-full bg-forest-800 px-4 text-sm font-medium text-cream-50 shadow-card-hover transition-colors hover:bg-forest-700"
      >
        <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">Feedback</span>
      </button>
    </div>
  );
}
