"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ToggleFavoriteCourseResult =
  | { ok: true; favorited: boolean }
  | { ok: false; error: string };

/**
 * Stars or un-stars a course as one of this golfer's "Saved Courses"
 * (Quick Round course-picker addendum). Deliberately a plain async
 * function rather than a useActionState-bound form action -- the
 * unified course picker calls this straight from a button's onClick
 * (see quick-round-course-picker.tsx), the same way importExternalCourseAction
 * and other one-shot lookups in this codebase are called directly.
 *
 * Read-then-write rather than a single upsert/delete so the caller
 * always gets back which state the course ended up in -- and because
 * course_favorites_user_course_unique (the migration's own unique
 * constraint) is what actually guarantees no duplicate saved-course
 * record can ever exist, a race between two taps just means one of the
 * two inserts fails harmlessly and the row already exists either way.
 */
export async function toggleFavoriteCourseAction(courseId: string): Promise<ToggleFavoriteCourseResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You need to be signed in." };
  }

  const { data: existing } = await supabase
    .from("course_favorites")
    .select("id")
    .eq("user_id", user.id)
    .eq("course_id", courseId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("course_favorites").delete().eq("id", existing.id);
    if (error) {
      return { ok: false, error: "Couldn't remove that saved course. Please try again." };
    }
    revalidatePath("/play/quick");
    return { ok: true, favorited: false };
  }

  const { error } = await supabase.from("course_favorites").insert({
    user_id: user.id,
    course_id: courseId,
  });
  // A unique-violation here just means another tap (or another tab)
  // already saved this course a moment ago -- that's still success from
  // this caller's point of view, not an error to surface.
  if (error && error.code !== "23505") {
    return { ok: false, error: "Couldn't save that course. Please try again." };
  }

  revalidatePath("/play/quick");
  return { ok: true, favorited: true };
}
