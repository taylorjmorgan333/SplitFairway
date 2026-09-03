import type { Database } from "@/lib/supabase/database.types";

export type RoundStatus = Database["public"]["Enums"]["round_status"];
export type RoundPhase = "setup" | "play" | "finish";

/**
 * The round lifecycle only ever moves scheduled -> in_progress -> locked
 * in this codebase today ('completed' exists in the DB enum but no
 * action ever sets it) -- this maps that lifecycle onto the redesign's
 * three phases. 'completed' is handled defensively alongside 'locked'
 * so nothing breaks if that transition is wired up later.
 *
 * Deliberately NOT in round-nav.tsx: that file is "use client", and
 * Next.js treats every export of a "use client" module as a client
 * reference -- a Server Component calling phaseForStatus() directly
 * (rather than rendering it as JSX) throws "Attempted to call
 * phaseForStatus() from the server but phaseForStatus is on the
 * client." Keeping this plain function in its own client-directive-free
 * module lets Server Components (the round detail page) call it
 * directly while round-nav.tsx's Client Components still import and use
 * it too.
 */
export function phaseForStatus(status: RoundStatus): RoundPhase {
  if (status === "scheduled") return "setup";
  if (status === "in_progress") return "play";
  return "finish";
}
