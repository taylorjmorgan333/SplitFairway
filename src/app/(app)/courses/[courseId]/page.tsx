import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GOLF_SCORING_ENABLED } from "@/lib/config";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EditCourseForm } from "@/components/courses/edit-course-form";
import { AddTeeSetForm } from "@/components/courses/add-tee-set-form";
import { TeeSetSection } from "@/components/courses/tee-set-section";
import { CourseDangerZone } from "@/components/courses/course-danger-zone";
import { CourseCorrectionForm } from "@/components/courses/course-correction-form";
import { RefreshCourseButton } from "@/components/courses/refresh-course-button";
import { GOLFCOURSE_API_ENABLED, GOLFCOURSE_API_REFRESH_ENABLED } from "@/lib/config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Course" };

const STATUS_BADGE = {
  pending: { label: "Pending review", variant: "gold" as const },
  approved: { label: "Approved", variant: "success" as const },
  rejected: { label: "Rejected", variant: "neutral" as const },
};

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  if (!GOLF_SCORING_ENABLED) {
    redirect("/dashboard");
  }

  const { courseId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // courses_select_visible silently returns no row if this course is
  // neither approved nor the caller's own — a missing row and a bad ID
  // look identical, both correctly render as not found.
  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .maybeSingle();

  if (!course) {
    notFound();
  }

  const { data: teeSets } = await supabase
    .from("course_tee_sets")
    .select("*")
    .eq("course_id", courseId)
    .order("created_at", { ascending: true });

  const teeSetRows = teeSets ?? [];
  const teeSetIds = teeSetRows.map((t) => t.id);

  const { data: holes } =
    teeSetIds.length > 0
      ? await supabase.from("course_holes").select("*").in("tee_set_id", teeSetIds)
      : { data: [] };

  const holeRows = holes ?? [];
  const { data: isAdmin } = await supabase.rpc("is_app_admin");
  const isProviderSourced = Boolean(course.external_source);
  // Provider-sourced course data may only be edited directly by an
  // admin (via a refresh from the provider, or a manual correction) --
  // never by whichever golfer happened to import it. A manually-entered
  // course keeps the original "creator or admin" rule.
  const canEdit = isProviderSourced ? Boolean(isAdmin) : course.created_by === user.id || Boolean(isAdmin);
  const badge = STATUS_BADGE[course.status];

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl">{course.name}</h1>
        {!isProviderSourced && course.created_by === user.id && course.status !== "approved" && (
          <Badge variant={badge.variant}>{badge.label}</Badge>
        )}
        <Badge variant={isProviderSourced ? "success" : "neutral"}>
          {isProviderSourced ? "GolfCourseAPI" : "Added by SplitFairway user"}
        </Badge>
      </div>
      <p className="mt-1.5 text-sm text-charcoal-500">
        {[course.city, course.state].filter(Boolean).join(", ") || "Location not set"}
        {" · "}
        {course.hole_count} holes
      </p>

      {isProviderSourced && isAdmin && GOLFCOURSE_API_ENABLED && GOLFCOURSE_API_REFRESH_ENABLED && (
        <div className="mt-4">
          <RefreshCourseButton courseId={course.id} />
        </div>
      )}

      {!canEdit && (
        <div className="mt-4">
          <CourseCorrectionForm courseId={course.id} />
        </div>
      )}

      {!isProviderSourced && (course.created_by === user.id || isAdmin) && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Course details</CardTitle>
            <CardDescription>
              {course.created_by === user.id
                ? "Entered by you — visible to everyone once approved."
                : "Entered by another user."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EditCourseForm course={course} />
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Tee sets and scorecards</CardTitle>
          <CardDescription>
            Par, yardage, and stroke index for each tee. A snapshot of these values is saved with
            every round when it starts, so editing a course later never changes a round already in
            progress.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {teeSetRows.length === 0 && (
            <p className="text-sm text-charcoal-400">No tee sets yet.</p>
          )}
          {teeSetRows.map((teeSet) => (
            <TeeSetSection
              key={teeSet.id}
              courseId={course.id}
              teeSet={teeSet}
              holeCount={course.hole_count}
              holes={holeRows.filter((h) => h.tee_set_id === teeSet.id)}
              canEdit={canEdit}
            />
          ))}

          {canEdit && (
            <div className="border-t border-charcoal-400/10 pt-4">
              <AddTeeSetForm courseId={course.id} />
            </div>
          )}
        </CardContent>
      </Card>

      {canEdit && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Danger zone</CardTitle>
          </CardHeader>
          <CardContent>
            <CourseDangerZone course={course} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
