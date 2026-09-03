import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GOLF_SCORING_ENABLED } from "@/lib/config";
import { Card, CardContent } from "@/components/ui/card";
import { CreateCourseForm } from "@/components/courses/create-course-form";

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
        Enter a course from memory or a scorecard — SplitFairway doesn&apos;t pull course data
        from any outside source.
      </p>

      <Card className="mt-6">
        <CardContent>
          <CreateCourseForm />
        </CardContent>
      </Card>
    </div>
  );
}
