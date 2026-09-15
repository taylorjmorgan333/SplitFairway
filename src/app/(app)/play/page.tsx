import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Search, Users, Luggage, Zap, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { GOLF_SCORING_ENABLED } from "@/lib/config";
import { Card } from "@/components/ui/card";
import { startQuickRoundAction } from "@/actions/groups";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Play" };

/**
 * Start a Round, step one: three plain-language choices, no unnecessary
 * information collected before scoring can begin. Quick Round submits
 * right here (nothing else to ask); Group Round and Trip Round each
 * need one more pick (which group / which trip) so they get their own
 * short step at /play/group and /play/trip. Course search lives here
 * too instead of its own nav item -- see /courses.
 */
export default async function PlayPage() {
  if (!GOLF_SCORING_ENABLED) {
    redirect("/home");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl">Start a Round</h1>
      <p className="mt-1.5 text-base text-charcoal-500">How do you want to play today?</p>

      <div className="mt-8 space-y-4">
        <form action={startQuickRoundAction}>
          <button type="submit" className="block w-full text-left">
            <Card className="flex items-center gap-4 p-5 transition-shadow hover:shadow-card-hover">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gold-100">
                <Zap className="h-6 w-6 text-gold-700" aria-hidden="true" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-medium text-forest-900">Quick Round</p>
                <p className="mt-0.5 text-base text-charcoal-500">
                  Start scoring right now — no group or trip needed.
                </p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-charcoal-400" aria-hidden="true" />
            </Card>
          </button>
        </form>

        <Link href="/play/group" className="block">
          <Card className="flex items-center gap-4 p-5 transition-shadow hover:shadow-card-hover">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-forest-800/10">
              <Users className="h-6 w-6 text-forest-700" aria-hidden="true" strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-medium text-forest-900">Group Round</p>
              <p className="mt-0.5 text-base text-charcoal-500">
                Play with a saved golf group — golfers and handicaps ready to go.
              </p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-charcoal-400" aria-hidden="true" />
          </Card>
        </Link>

        <Link href="/play/trip" className="block">
          <Card className="flex items-center gap-4 p-5 transition-shadow hover:shadow-card-hover">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-forest-800/10">
              <Luggage className="h-6 w-6 text-forest-700" aria-hidden="true" strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-medium text-forest-900">Trip Round</p>
              <p className="mt-0.5 text-base text-charcoal-500">
                Attach this round to a trip you&apos;re already planning.
              </p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-charcoal-400" aria-hidden="true" />
          </Card>
        </Link>
      </div>

      <Link href="/courses" className="mt-8 flex items-center gap-3 rounded-2xl border border-dashed border-forest-900/15 p-4 text-forest-800 transition-colors hover:bg-forest-800/5">
        <Search className="h-5 w-5" aria-hidden="true" />
        <span className="text-base font-medium">Search courses</span>
        <ChevronRight className="ml-auto h-4 w-4 text-charcoal-400" aria-hidden="true" />
      </Link>
    </div>
  );
}
