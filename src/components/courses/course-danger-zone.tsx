"use client";

import { useFormStatus } from "react-dom";
import { deleteCourseAction } from "@/actions/courses";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/lib/supabase/database.types";

function DeleteSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="ghost"
      size="sm"
      disabled={pending}
      className="text-red-700 hover:bg-red-50"
    >
      {pending ? "Deleting…" : "Delete course"}
    </Button>
  );
}

/**
 * Lets a course's creator (or an admin) remove it from the library.
 * Safe for existing rounds -- see the comment on deleteCourseAction --
 * so the confirmation only needs to warn about the library/scheduling
 * side of things, not about breaking a round already set up.
 */
export function CourseDangerZone({ course }: { course: Tables<"courses"> }) {
  const boundDelete = deleteCourseAction.bind(null, course.id);

  return (
    <div className="space-y-2">
      <form
        action={boundDelete}
        onSubmit={(event) => {
          if (
            !window.confirm(
              `Delete "${course.name}" from the course library? Rounds already scheduled on it keep their own saved scorecard and won't be affected, but no one will be able to pick this course for a new round anymore. This cannot be undone.`,
            )
          ) {
            event.preventDefault();
          }
        }}
      >
        <DeleteSubmitButton />
      </form>
      <p className="text-xs text-charcoal-400">
        Removes this course from the shared library. Existing rounds keep the scorecard they were
        set up with.
      </p>
    </div>
  );
}
