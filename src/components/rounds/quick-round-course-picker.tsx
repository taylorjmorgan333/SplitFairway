"use client";

import { useState, useTransition } from "react";
import { Star, ChevronRight } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { ExternalCourseSearch } from "@/components/courses/external-course-search";
import { getCourseForWizardAction } from "@/actions/course-import";
import { createQuickCourseAction } from "@/actions/quick-round";
import { HOLE_COUNT_VALUES } from "@/lib/validation/course";
import type { QuickRoundCourseChoice } from "@/lib/golf/quick-round-course-list";
import { cn } from "@/lib/utils";

export interface SelectedQuickRoundCourse {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  holeCount: number;
  teeSetNames: string[];
}

function formatLocation(city: string | null, state: string | null): string | null {
  const parts = [city, state].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

function formatLastPlayed(dateStr: string | null): string | null {
  if (!dateStr) return null;
  try {
    const d = new Date(`${dateStr}T00:00:00`);
    return `Last played ${d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
  } catch {
    return null;
  }
}

function CourseRow({
  course,
  onSelect,
}: {
  course: QuickRoundCourseChoice;
  onSelect: () => void;
}) {
  const location = formatLocation(course.city, course.state);
  const lastPlayed = formatLastPlayed(course.lastPlayedDate);
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-charcoal-400/15 p-3 text-left transition-colors hover:bg-forest-800/5"
    >
      <div className="min-w-0">
        <p className="truncate text-base font-medium text-charcoal-800">{course.name}</p>
        {(location || lastPlayed) && (
          <p className="truncate text-base text-charcoal-400">
            {[location, lastPlayed].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-charcoal-400" aria-hidden="true" />
    </button>
  );
}

/**
 * The unified course-selection panel (Quick Round course-picker
 * addendum): Saved Courses, Search for a New Course, and Manual Course
 * all in one dialog, so Quick Round setup never has to send anyone to
 * a separate Courses page. Built on the app's existing bottom-sheet
 * Dialog primitive (dialog.tsx) rather than a new modal, and reuses
 * ExternalCourseSearch as-is (its onSelect prop already exists exactly
 * for this -- see the Group Round fast-start wizard) plus
 * getCourseForWizardAction to resolve a search pick's tee sets before
 * handing it back to the caller.
 */
export function QuickRoundCoursePicker({
  open,
  onClose,
  courseChoices,
  courseSearchEnabled,
  manualCourseEntryEnabled,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  courseChoices: QuickRoundCourseChoice[];
  courseSearchEnabled: boolean;
  manualCourseEntryEnabled: boolean;
  onSelect: (course: SelectedQuickRoundCourse) => void;
}) {
  const [isLoadingCourse, startCourseTransition] = useTransition();
  const [courseLoadError, setCourseLoadError] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualFieldErrors, setManualFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [isSavingManual, startManualTransition] = useTransition();
  const [manualHoleCount, setManualHoleCount] = useState<9 | 18>(18);

  const saved = courseChoices.filter((c) => c.favorited);
  const recent = courseChoices.filter((c) => !c.favorited);

  function handleSelectChoice(course: QuickRoundCourseChoice) {
    onSelect({
      id: course.id,
      name: course.name,
      city: course.city,
      state: course.state,
      holeCount: course.holeCount,
      teeSetNames: course.teeSetNames,
    });
    onClose();
  }

  function handleSearchFound({ courseId, name }: { courseId: string; name: string }) {
    setCourseLoadError(null);
    startCourseTransition(async () => {
      const detail = await getCourseForWizardAction(courseId);
      if (!detail) {
        setCourseLoadError("Couldn't load that course's details -- try again, or add it manually.");
        return;
      }
      onSelect({
        id: detail.id,
        name: detail.name || name,
        city: null,
        state: null,
        holeCount: detail.holeCount,
        teeSetNames: detail.teeSetNames,
      });
      onClose();
    });
  }

  function handleManualSubmit(formData: FormData) {
    setManualError(null);
    setManualFieldErrors({});
    startManualTransition(async () => {
      const result = await createQuickCourseAction(formData);
      if (!result.ok) {
        setManualError(result.error);
        setManualFieldErrors(result.fieldErrors ?? {});
        return;
      }
      onSelect({
        id: result.courseId,
        name: result.name,
        city: null,
        state: null,
        holeCount: Number(formData.get("holeCount")) || 18,
        teeSetNames: [],
      });
      onClose();
    });
  }

  return (
    <Dialog open={open} onClose={onClose} title="Choose a course" className="sm:max-w-lg">
      <div className="space-y-5">
        {courseSearchEnabled && (
          <div>
            <p className="mb-1.5 text-base font-medium text-forest-900">Search for a course</p>
            <ExternalCourseSearch onSelect={handleSearchFound} />
            {isLoadingCourse && <p className="mt-2 text-base text-charcoal-400">Loading course details…</p>}
            {courseLoadError && (
              <Alert variant="error" className="mt-2">
                {courseLoadError}
              </Alert>
            )}
          </div>
        )}

        {saved.length > 0 && (
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-base font-medium uppercase tracking-wide text-charcoal-400">
              <Star className="h-3.5 w-3.5 fill-gold-400 text-gold-500" aria-hidden="true" />
              Saved Courses
            </p>
            {saved.map((c) => (
              <CourseRow key={c.id} course={c} onSelect={() => handleSelectChoice(c)} />
            ))}
          </div>
        )}

        {recent.length > 0 && (
          <div className="space-y-2">
            <p className="text-base font-medium uppercase tracking-wide text-charcoal-400">Recently Played</p>
            {recent.map((c) => (
              <CourseRow key={c.id} course={c} onSelect={() => handleSelectChoice(c)} />
            ))}
          </div>
        )}

        {saved.length === 0 && recent.length === 0 && !courseSearchEnabled && (
          <p className="text-base text-charcoal-500">
            You don&apos;t have any saved or recently played courses yet.
          </p>
        )}

        {manualCourseEntryEnabled && (
          <div className="border-t border-charcoal-400/10 pt-4">
            {!showManual ? (
              <button
                type="button"
                onClick={() => setShowManual(true)}
                className="text-base font-medium text-forest-800 underline underline-offset-2"
              >
                Can&apos;t find your course? Add it manually.
              </button>
            ) : (
              <form
                action={handleManualSubmit}
                className="space-y-3"
                onSubmit={(e) => {
                  // Native <form action={fn}> already handles this, but
                  // guard against a stray double-tap while the request
                  // is in flight.
                  if (isSavingManual) e.preventDefault();
                }}
              >
                <p className="text-base font-medium text-forest-900">Add a course manually</p>
                {manualError && <Alert variant="error">{manualError}</Alert>}
                <div>
                  <label htmlFor="manual-course-name" className="mb-1 block text-base font-medium text-forest-900">
                    Course name
                  </label>
                  <Input id="manual-course-name" name="name" required placeholder="Course name" className="text-base" />
                  {manualFieldErrors.name && (
                    <p className="mt-1 text-base text-red-600">{manualFieldErrors.name[0]}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="manual-course-city" className="mb-1 block text-base font-medium text-forest-900">
                      City
                    </label>
                    <Input id="manual-course-city" name="city" placeholder="City" className="text-base" />
                  </div>
                  <div>
                    <label htmlFor="manual-course-state" className="mb-1 block text-base font-medium text-forest-900">
                      State
                    </label>
                    <Input id="manual-course-state" name="state" placeholder="State" className="text-base" />
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-base font-medium text-forest-900">Holes</p>
                  <input type="hidden" name="holeCount" value={manualHoleCount} />
                  <div className="flex gap-2">
                    {HOLE_COUNT_VALUES.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setManualHoleCount(n)}
                        className={cn(
                          "flex h-11 flex-1 items-center justify-center rounded-lg border text-base font-medium transition-colors",
                          manualHoleCount === n
                            ? "border-forest-700 bg-forest-800/[0.08] text-forest-900"
                            : "border-charcoal-400/25 text-charcoal-700",
                        )}
                      >
                        {n} holes
                      </button>
                    ))}
                  </div>
                </div>
                <Button type="submit" size="md" className="w-full" disabled={isSavingManual}>
                  {isSavingManual ? "Adding…" : "Add Course"}
                </Button>
              </form>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
