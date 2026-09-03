import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GOLF_SCORING_ENABLED } from "@/lib/config";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ISSUE_TYPE_LABELS } from "@/lib/validation/course-correction";
import { CorrectionReviewActions } from "@/components/courses/correction-review-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Course corrections" };

/**
 * Admin-only review queue for course_corrections (see
 * src/actions/course-corrections.ts). Approving/rejecting here only
 * records the decision -- it never rewrites the course itself; an admin
 * who agrees still edits the course/tee-set/hole through the normal
 * (already-admin-accessible) edit forms on that course's own page.
 */
export default async function CourseCorrectionsAdminPage() {
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

  const { data: isAdmin } = await supabase.rpc("is_app_admin");
  if (!isAdmin) {
    redirect("/dashboard");
  }

  const { data: corrections } = await supabase
    .from("course_corrections")
    .select("id, course_id, issue_type, hole_number, current_value, proposed_value, reason, status, created_at, courses(name)")
    .order("created_at", { ascending: false })
    .limit(100);

  type CorrectionRow = {
    id: string;
    course_id: string;
    issue_type: string;
    hole_number: number | null;
    current_value: string | null;
    proposed_value: string | null;
    reason: string;
    status: string;
    created_at: string;
    courses: { name: string } | { name: string }[] | null;
  };

  function courseName(row: CorrectionRow): string {
    if (!row.courses) return "Course";
    return Array.isArray(row.courses) ? (row.courses[0]?.name ?? "Course") : row.courses.name;
  }

  const rows = (corrections ?? []) as CorrectionRow[];
  const pending = rows.filter((r) => r.status === "pending");
  const decided = rows.filter((r) => r.status !== "pending");

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl">Course corrections</h1>
        <Link href="/admin/golfcourseapi" className="text-sm text-charcoal-500 underline underline-offset-2">
          GolfCourseAPI usage →
        </Link>
      </div>
      <p className="mt-1.5 text-sm text-charcoal-500">Admin-only. User-submitted reports on course data.</p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Pending ({pending.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {pending.length === 0 && <p className="text-sm text-charcoal-400">Nothing to review.</p>}
          {pending.map((c) => (
            <div key={c.id} className="rounded-lg border border-charcoal-400/15 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-charcoal-800">
                    {courseName(c)} — {ISSUE_TYPE_LABELS[c.issue_type as keyof typeof ISSUE_TYPE_LABELS]}
                  </p>
                  <p className="text-xs text-charcoal-400">
                    {c.hole_number ? `Hole ${c.hole_number} · ` : ""}
                    {c.current_value ? `Current: ${c.current_value} → ` : ""}
                    {c.proposed_value ? `Proposed: ${c.proposed_value}` : ""}
                  </p>
                  <p className="mt-1 text-sm text-charcoal-600">{c.reason}</p>
                </div>
                <Link href={`/courses/${c.course_id}`} className="shrink-0 text-xs text-charcoal-500 underline">
                  View
                </Link>
              </div>
              <div className="mt-2">
                <CorrectionReviewActions correctionId={c.id} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {decided.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Reviewed</CardTitle>
            <CardDescription>Most recent 100, including pending.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {decided.map((c) => (
              <div key={c.id} className="flex items-center justify-between text-sm">
                <span className="text-charcoal-600">
                  {courseName(c)} — {ISSUE_TYPE_LABELS[c.issue_type as keyof typeof ISSUE_TYPE_LABELS]}
                </span>
                <span className={c.status === "approved" ? "text-emerald-700" : "text-charcoal-400"}>
                  {c.status}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
