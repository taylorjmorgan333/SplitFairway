import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GOLF_SCORING_ENABLED } from "@/lib/config";
import { Card, CardContent } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CourseListDeleteButton } from "@/components/courses/course-list-delete-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Courses" };

const STATUS_BADGE = {
  pending: { label: "Pending review", variant: "gold" as const },
  approved: { label: "Approved", variant: "success" as const },
  rejected: { label: "Rejected", variant: "neutral" as const },
};

export default async function CoursesPage() {
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

  // courses_select_visible (supabase/migrations/20260903030000_courses.sql)
  // already restricts this to approved courses plus the caller's own —
  // no extra filtering needed here.
  const { data: courses } = await supabase
    .from("courses")
    .select("id, name, city, state, hole_count, status, created_by")
    .order("name", { ascending: true });

  const rows = courses ?? [];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl">Courses</h1>
          <p className="mt-1.5 text-sm text-charcoal-500">
            A shared library of courses and tee sets, entered by golfers like you.
          </p>
        </div>
        <ButtonLink href="/courses/new" variant="primary" size="sm">
          Add a course
        </ButtonLink>
      </div>

      {rows.length === 0 ? (
        <Card className="mt-6">
          <CardContent>
            <p className="text-sm text-charcoal-500">
              No courses yet. Add the first one to start building scorecards.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 space-y-3">
          {rows.map((course) => {
            const badge = STATUS_BADGE[course.status];
            const isOwn = course.created_by === user.id;
            return (
              <Card key={course.id} className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-center justify-between gap-3">
                  <Link href={`/courses/${course.id}`} className="min-w-0 flex-1">
                    <p className="font-medium text-forest-900">{course.name}</p>
                    <p className="mt-0.5 text-xs text-charcoal-400">
                      {[course.city, course.state].filter(Boolean).join(", ") || "Location not set"}
                      {" · "}
                      {course.hole_count} holes
                    </p>
                  </Link>
                  <div className="flex items-center gap-3">
                    {isOwn && course.status !== "approved" && (
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    )}
                    {isOwn && <CourseListDeleteButton courseId={course.id} courseName={course.name} />}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
