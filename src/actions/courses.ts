"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { courseSchema, teeSetSchema, holesFormSchema } from "@/lib/validation/course";
import type { ActionState } from "@/actions/auth";

/**
 * Deletes a course from the shared library. RLS
 * (courses_delete_own_or_admin, supabase/migrations/20260903030000_courses.sql)
 * enforces that only the course's creator or an admin can succeed here.
 * Safe against rounds already scheduled on this course: rounds.course_id
 * is a soft reference (on delete set null), and a round's own
 * round_course_snapshots row already carries its own permanent copy of
 * the course/tee/hole data from when it was created, so an existing
 * round keeps working exactly as before -- only the course_id link and
 * the ability to schedule *new* rounds against this course go away.
 * Submitted as a real <form> (not called via useTransition) so the
 * redirect below is a normal Next.js redirect, not something a
 * try/catch would need to special-case.
 */
export async function deleteCourseAction(courseId: string): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("courses").delete().eq("id", courseId).select("id");

  if (error) {
    console.error("deleteCourseAction: Supabase delete error", error.message);
    throw new Error("Couldn't delete this course.");
  }

  if (!data || data.length === 0) {
    // RLS silently reports zero rows affected (no `error`) instead of
    // raising one, both when another golfer's course is targeted and
    // when the course is already gone -- so this is the only reliable
    // place to tell those apart from a real success.
    throw new Error(
      "Couldn't delete this course — it may already be gone, or you may not have permission.",
    );
  }

  revalidatePath("/courses");
  revalidatePath(`/courses/${courseId}`);
  redirect("/courses");
}

/**
 * Creates a course. Always created_by = the caller, status = 'pending'
 * (the courses_insert_own RLS policy in
 * supabase/migrations/20260903030000_courses.sql doesn't let a client
 * set created_by to anyone else, or set status at all on insert since
 * the column simply isn't sent here) — the creator can use their own
 * course immediately (courses_select_visible), and it becomes visible
 * to other golfers once an admin approves it.
 */
export async function createCourseAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = courseSchema.safeParse({
    name: formData.get("name"),
    city: formData.get("city"),
    state: formData.get("state"),
    holeCount: formData.get("holeCount"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "error", message: "You need to be signed in to add a course." };
  }

  const { data, error } = await supabase
    .from("courses")
    .insert({
      created_by: user.id,
      name: parsed.data.name,
      city: parsed.data.city || null,
      state: parsed.data.state || null,
      hole_count: parsed.data.holeCount,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { status: "error", message: "Something went wrong creating the course." };
  }

  revalidatePath("/courses");
  redirect(`/courses/${data.id}`);
}

/**
 * Edits a course's own details. RLS (courses_update_own_or_admin)
 * enforces that only the creator or an admin can succeed here — there's
 * no separate authorization check to forget in the UI layer. Deliberately
 * never touches `status`: an ordinary golfer has no UI path to approve
 * their own course, even though RLS technically permits it (see the
 * comment on courses_update_own_or_admin in the migration for why that's
 * an acceptable, non-escalating gap rather than one closed here).
 */
export async function updateCourseAction(
  courseId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = courseSchema.safeParse({
    name: formData.get("name"),
    city: formData.get("city"),
    state: formData.get("state"),
    holeCount: formData.get("holeCount"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("courses")
    .update({
      name: parsed.data.name,
      city: parsed.data.city || null,
      state: parsed.data.state || null,
      hole_count: parsed.data.holeCount,
    })
    .eq("id", courseId);

  if (error) {
    return { status: "error", message: "Something went wrong saving the course." };
  }

  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/courses");
  return { status: "success", message: "Course details saved." };
}

export async function createTeeSetAction(
  courseId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = teeSetSchema.safeParse({ name: formData.get("name") });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("course_tee_sets").insert({
    course_id: courseId,
    name: parsed.data.name,
  });

  if (error) {
    return {
      status: "error",
      message: "Couldn't add that tee set — make sure you created this course.",
    };
  }

  revalidatePath(`/courses/${courseId}`);
  return { status: "success", message: "Tee set added." };
}

/** Removing a tee set cascades to its holes (course_holes fk on delete cascade). */
export async function deleteTeeSetAction(courseId: string, teeSetId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("course_tee_sets").delete().eq("id", teeSetId);

  if (error) {
    throw new Error("Couldn't remove that tee set.");
  }

  revalidatePath(`/courses/${courseId}`);
}

/**
 * Saves an entire tee set's hole-by-hole par/yardage/stroke-index grid
 * in one submission — the form serializes the grid rows to JSON in a
 * hidden "holes" field rather than posting one row per hole, since the
 * row count varies (9 or 18) and this keeps the whole scorecard a single
 * atomic save. Replaces (rather than merges) the tee set's holes, so a
 * hole removed from the grid client-side is actually removed here too.
 */
export async function saveHolesAction(
  courseId: string,
  teeSetId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let rawHoles: unknown;
  try {
    rawHoles = JSON.parse(String(formData.get("holes") ?? "[]"));
  } catch {
    return { status: "error", message: "Something went wrong reading the scorecard grid." };
  }

  const parsed = holesFormSchema.safeParse(rawHoles);
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.errors[0]?.message ?? "Check the scorecard values and try again.",
    };
  }

  const supabase = await createClient();

  // Replace-in-place: delete this tee set's existing holes, then insert
  // the submitted grid. Both run under the same RLS as the caller, so a
  // non-owner/non-admin simply gets zero rows affected on the delete and
  // an insert failure on the write_own_or_admin policy — never a partial
  // write of someone else's course.
  const { error: deleteError } = await supabase
    .from("course_holes")
    .delete()
    .eq("tee_set_id", teeSetId);

  if (deleteError) {
    return { status: "error", message: "Couldn't save the scorecard. Please try again." };
  }

  if (parsed.data.length > 0) {
    const { error: insertError } = await supabase.from("course_holes").insert(
      parsed.data.map((hole) => ({
        tee_set_id: teeSetId,
        hole_number: hole.holeNumber,
        par: hole.par,
        yardage: hole.yardage,
        stroke_index: hole.strokeIndex,
      })),
    );

    if (insertError) {
      return { status: "error", message: "Couldn't save the scorecard. Please try again." };
    }
  }

  revalidatePath(`/courses/${courseId}`);
  return { status: "success", message: "Scorecard saved." };
}
