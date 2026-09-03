"use client";

import { useFormStatus } from "react-dom";
import { deleteCourseAction } from "@/actions/courses";

function DeleteButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="text-xs font-medium text-red-700 underline hover:no-underline disabled:opacity-50"
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}

/**
 * Compact delete control for a course card on the /courses library list
 * -- the same action and confirmation copy as course-danger-zone.tsx
 * (the course detail page's version), just sized for a list row instead
 * of its own card. Deliberately a real <form> rather than a
 * useTransition click handler: deleteCourseAction ends in a Next.js
 * redirect(), which resolves correctly from a form submission the same
 * way course-danger-zone.tsx's does.
 */
export function CourseListDeleteButton({ courseId, courseName }: { courseId: string; courseName: string }) {
  const boundDelete = deleteCourseAction.bind(null, courseId);

  return (
    <form
      action={boundDelete}
      onSubmit={(event) => {
        if (
          !window.confirm(
            `Delete "${courseName}" from the course library? Rounds already scheduled on it keep their own saved scorecard and won't be affected, but no one will be able to pick this course for a new round anymore. This cannot be undone.`,
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <DeleteButton />
    </form>
  );
}
