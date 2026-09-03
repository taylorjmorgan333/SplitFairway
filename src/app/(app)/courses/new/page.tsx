import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GOLF_SCORING_ENABLED } from "@/lib/config";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CreateCourseForm } from "@/components/courses/create-course-form";
import { ExternalCourseSearch } from "@/components/courses/external-course-search";

export const metadata: Metadata = { title: "Add a course" };

export default async function NewCoursePage() {
  if (!GOLF_SCORING_ENABLED) {
    redirect("/dashboard");
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
      <h1 className="text-2xl">Add a course</h1>
      <p className="mt-1.5 text-sm text-charcoal-500">
        Search for a course, or enter one from memory or a scorecard.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Search for a course</CardTitle>
          <CardDescription>
            Imported courses are ready to use right away — no admin review needed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ExternalCourseSearch />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Or add a course manually</CardTitle>
          <CardDescription>
            Can&apos;t find it above? Enter it by hand — it&apos;s yours to use immediately, and
            becomes visible to other golfers once an admin approves it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateCourseForm />
        </CardContent>
      </Card>
    </div>
  );
}
