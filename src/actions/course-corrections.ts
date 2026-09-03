"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { courseCorrectionSchema } from "@/lib/validation/course-correction";
import type { ActionState } from "@/actions/auth";

/**
 * Submits a proposed correction to a course. This never edits the shared
 * courses/course_tee_sets/course_holes rows itself -- it only inserts a
 * row into course_corrections for an admin to review (see
 * reviewCourseCorrectionAction below). That's true for every course, not
 * just provider-imported ones: even a manually-entered course is shared
 * once approved, so a correction from anyone other than its own creator
 * still goes through review rather than silently overwriting someone
 * else's entry.
 */
export async function submitCourseCorrectionAction(
  courseId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = courseCorrectionSchema.safeParse({
    issueType: formData.get("issueType"),
    holeNumber: formData.get("holeNumber"),
    currentValue: formData.get("currentValue"),
    proposedValue: formData.get("proposedValue"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: "error", message: "You need to be signed in to report an issue." };
  }

  const { error } = await supabase.from("course_corrections").insert({
    course_id: courseId,
    submitted_by: user.id,
    issue_type: parsed.data.issueType,
    hole_number: parsed.data.holeNumber,
    current_value: parsed.data.currentValue,
    proposed_value: parsed.data.proposedValue,
    reason: parsed.data.reason,
  });

  if (error) {
    return { status: "error", message: "Something went wrong submitting that report." };
  }

  revalidatePath(`/courses/${courseId}`);
  return { status: "success", message: "Thanks — an admin will review this." };
}

export type ReviewCourseCorrectionResult = { ok: true } | { ok: false; error: string };

/**
 * Admin-only approve/reject of a submitted correction. Approving does
 * NOT automatically rewrite the course -- deliberately: the whole point
 * of a review queue is a human decides what actually changes, and the
 * spec is explicit that provider-sourced records are never overwritten
 * by an unattended process. An admin who agrees with a correction edits
 * the course/tee-set/hole themselves (via the existing
 * courses_update_own_or_admin-backed edit forms, open to them on any
 * course) and then marks it approved here as a record of that decision.
 */
export async function reviewCourseCorrectionAction(
  correctionId: string,
  decision: "approved" | "rejected",
): Promise<ReviewCourseCorrectionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You need to be signed in." };
  }

  const { data: isAdmin } = await supabase.rpc("is_app_admin");
  if (!isAdmin) {
    return { ok: false, error: "Only an admin can review corrections." };
  }

  const { data, error } = await supabase
    .from("course_corrections")
    .update({ status: decision, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq("id", correctionId)
    .select("id, course_id");

  if (error || !data || data.length === 0) {
    return { ok: false, error: "Couldn't update that correction." };
  }

  revalidatePath("/admin/course-corrections");
  revalidatePath(`/courses/${data[0].course_id}`);
  return { ok: true };
}
