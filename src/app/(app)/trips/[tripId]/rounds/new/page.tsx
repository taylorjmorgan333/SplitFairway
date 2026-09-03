import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GOLF_SCORING_ENABLED } from "@/lib/config";
import { Card, CardContent } from "@/components/ui/card";
import { CreateRoundForm } from "@/components/rounds/create-round-form";
import { SetupStepNav } from "@/components/rounds/round-nav";

export const metadata: Metadata = { title: "Set Up Round" };

export default async function NewRoundPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  if (!GOLF_SCORING_ENABLED) {
    redirect("/dashboard");
  }

  const { tripId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // courses_select_visible already limits this to approved courses plus
  // ones the caller created themselves.
  const { data: courses } = await supabase
    .from("courses")
    .select("id, name, hole_count")
    .order("name", { ascending: true });

  return (
    <div className="mx-auto max-w-xl">
      <SetupStepNav tripId={tripId} roundId={null} currentStep={1} />

      <h1 className="text-2xl">Set Up Round</h1>
      <p className="mt-1.5 text-sm text-charcoal-500">
        Pick a course from your library. You&apos;ll add golfers, choose tees and set up games next.
      </p>

      <Card className="mt-6">
        <CardContent>
          <CreateRoundForm tripId={tripId} courses={courses ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
