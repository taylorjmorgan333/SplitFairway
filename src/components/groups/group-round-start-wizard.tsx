"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { startFastGroupRoundAction } from "@/actions/group-rounds";
import { getCourseForWizardAction } from "@/actions/course-import";
import { mergeCourseChoices } from "@/lib/golf/course-selection";
import type { ActionState } from "@/actions/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { ExternalCourseSearch } from "@/components/courses/external-course-search";

const initialState: ActionState = { status: "idle" };

interface Member {
  id: string;
  userId: string | null;
  displayName: string;
  defaultHandicapIndex: number | null;
  preferredTeeName: string | null;
}

interface RecentCourse {
  id: string;
  name: string;
  holeCount: number;
  teeSetNames: string[];
}

interface Preset {
  id: string;
  name: string;
  sideGameType: string;
}

type PlayerDraft = { memberId: string; teeSetName: string; playingHandicap: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Starting…" : "Start Round"}
    </Button>
  );
}

/**
 * The fast Group Round start flow (spec item 2): course -> golfers ->
 * confirm tees/handicaps -> pick a game -> one final summary before
 * starting. Every step is prefilled from what the group already has
 * saved (recently played courses, each golfer's saved handicap/tee),
 * so the normal path is mostly just tapping "Continue" through
 * already-correct defaults.
 */
export function GroupRoundStartWizard({
  groupId,
  members,
  recentCourses,
  presets,
  courseSearchEnabled,
}: {
  groupId: string;
  members: Member[];
  recentCourses: RecentCourse[];
  presets: Preset[];
  /**
   * Threaded from the server page rather than read from
   * lib/config.ts here directly -- this is a client component, and a
   * non-NEXT_PUBLIC_ env flag reads as undefined in browser code.
   */
  courseSearchEnabled: boolean;
}) {
  const [step, setStep] = useState(0);
  const [courseId, setCourseId] = useState(recentCourses[0]?.id ?? "");
  const [searchedCourse, setSearchedCourse] = useState<RecentCourse | null>(null);
  const [showSearch, setShowSearch] = useState(recentCourses.length === 0);
  const [courseLoadError, setCourseLoadError] = useState<string | null>(null);
  const [isLoadingCourse, startCourseTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(members.map((m) => m.id)));
  const [drafts, setDrafts] = useState<Record<string, PlayerDraft>>({});
  const [gameChoice, setGameChoice] = useState<string>("none");

  const action = startFastGroupRoundAction.bind(null, groupId);
  const [state, formAction] = useActionState(action, initialState);

  function handleCourseFound({ courseId: foundId }: { courseId: string; name: string }) {
    setCourseLoadError(null);
    startCourseTransition(async () => {
      const detail = await getCourseForWizardAction(foundId);
      if (!detail) {
        setCourseLoadError("Couldn't load that course's tee sets -- try again, or add it manually.");
        return;
      }
      setSearchedCourse({ id: detail.id, name: detail.name, holeCount: detail.holeCount, teeSetNames: detail.teeSetNames });
      setCourseId(detail.id);
    });
  }

  const allCourses = mergeCourseChoices(recentCourses, searchedCourse);
  const course = allCourses.find((c) => c.id === courseId) ?? allCourses[0];
  const selectedMembers = members.filter((m) => selectedIds.has(m.id));

  function draftFor(m: Member): PlayerDraft {
    return (
      drafts[m.id] ?? {
        memberId: m.id,
        teeSetName: m.preferredTeeName && course?.teeSetNames.includes(m.preferredTeeName) ? m.preferredTeeName : course?.teeSetNames[0] ?? "",
        playingHandicap: m.defaultHandicapIndex != null ? String(m.defaultHandicapIndex) : "",
      }
    );
  }

  function updateDraft(memberId: string, patch: Partial<PlayerDraft>) {
    setDrafts((prev) => ({ ...prev, [memberId]: { ...draftFor(members.find((m) => m.id === memberId)!), ...prev[memberId], ...patch } }));
  }

  const playersJson = useMemo(
    () => JSON.stringify(selectedMembers.map((m) => draftFor(m))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedMembers, drafts, course],
  );

  const selectedPreset = presets.find((p) => p.id === gameChoice);

  return (
    <div className="mt-6">
      {state.status === "error" && state.message && <Alert variant="error" className="mb-4">{state.message}</Alert>}

      {step === 0 && (
        <Card>
          <CardContent className="space-y-3 p-5">
            <p className="text-base font-medium text-forest-900">Which course?</p>

            {recentCourses.length > 0 && (
              <>
                <p className="text-xs font-medium uppercase tracking-wide text-charcoal-400">Recently played</p>
                {recentCourses.map((c) => (
                  <label key={c.id} className="flex items-center gap-3 rounded-lg border border-charcoal-400/15 p-3 text-base text-charcoal-700">
                    <input
                      type="radio"
                      name="courseChoice"
                      checked={courseId === c.id}
                      onChange={() => setCourseId(c.id)}
                      className="h-5 w-5 accent-forest-700"
                    />
                    {c.name}
                  </label>
                ))}
                {searchedCourse && (
                  <label className="flex items-center gap-3 rounded-lg border border-forest-700/25 bg-forest-50 p-3 text-base text-charcoal-700">
                    <input
                      type="radio"
                      name="courseChoice"
                      checked={courseId === searchedCourse.id}
                      onChange={() => setCourseId(searchedCourse.id)}
                      className="h-5 w-5 accent-forest-700"
                    />
                    {searchedCourse.name} <span className="text-xs text-charcoal-400">(from search)</span>
                  </label>
                )}
              </>
            )}

            {!showSearch && (
              <Button type="button" variant="outline" size="sm" onClick={() => setShowSearch(true)}>
                Search All Courses
              </Button>
            )}

            {showSearch && (
              <div className="space-y-2 border-t border-charcoal-400/10 pt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-charcoal-400">Search All Courses</p>
                {courseSearchEnabled ? (
                  <ExternalCourseSearch onSelect={handleCourseFound} />
                ) : (
                  <p className="text-sm text-charcoal-500">
                    Course search isn&apos;t turned on right now.
                  </p>
                )}
                {isLoadingCourse && <p className="text-sm text-charcoal-400">Loading course details…</p>}
                {courseLoadError && <Alert variant="error">{courseLoadError}</Alert>}
                <p className="text-xs text-charcoal-400">
                  Can&apos;t find it?{" "}
                  <ButtonLink href="/courses/new" variant="ghost" size="sm">
                    Add a course manually
                  </ButtonLink>
                  , then search again here.
                </p>
              </div>
            )}

            <ButtonLink href="/play" variant="ghost" size="sm">
              Play somewhere else instead
            </ButtonLink>
            <Button size="lg" className="w-full" onClick={() => setStep(1)} disabled={!courseId || isLoadingCourse}>
              Continue
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardContent className="space-y-3 p-5">
            <p className="text-base font-medium text-forest-900">Who&apos;s playing?</p>
            {members.map((m) => (
              <label key={m.id} className="flex items-center gap-3 rounded-lg border border-charcoal-400/15 p-3 text-base text-charcoal-700">
                <input
                  type="checkbox"
                  checked={selectedIds.has(m.id)}
                  onChange={(e) => {
                    setSelectedIds((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(m.id);
                      else next.delete(m.id);
                      return next;
                    });
                  }}
                  className="h-5 w-5 accent-forest-700"
                />
                {m.displayName}
              </label>
            ))}
            <div className="flex gap-2">
              <Button variant="outline" size="lg" className="flex-1" onClick={() => setStep(0)}>
                Back
              </Button>
              <Button size="lg" className="flex-1" onClick={() => setStep(2)} disabled={selectedMembers.length === 0}>
                Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardContent className="space-y-4 p-5">
            <p className="text-base font-medium text-forest-900">Confirm tees &amp; handicaps</p>
            {selectedMembers.map((m) => {
              const draft = draftFor(m);
              return (
                <div key={m.id} className="rounded-lg border border-charcoal-400/15 p-3">
                  <p className="text-base font-medium text-charcoal-800">{m.displayName}</p>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <select
                      value={draft.teeSetName}
                      onChange={(e) => updateDraft(m.id, { teeSetName: e.target.value })}
                      className="h-11 rounded-lg border border-charcoal-400/25 bg-white px-2 text-sm text-charcoal"
                    >
                      <option value="">No tee</option>
                      {(course?.teeSetNames ?? []).map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                    <Input
                      type="number"
                      step="0.1"
                      min="-10"
                      max="54"
                      placeholder="Handicap"
                      value={draft.playingHandicap}
                      onChange={(e) => updateDraft(m.id, { playingHandicap: e.target.value })}
                    />
                  </div>
                </div>
              );
            })}
            <div className="flex gap-2">
              <Button variant="outline" size="lg" className="flex-1" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button size="lg" className="flex-1" onClick={() => setStep(3)}>
                Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <form action={formAction}>
          <input type="hidden" name="courseId" value={courseId} />
          <input type="hidden" name="players" value={playersJson} />
          <input type="hidden" name="presetId" value={selectedPreset ? selectedPreset.id : ""} />

          <Card>
            <CardContent className="space-y-3 p-5">
              <p className="text-base font-medium text-forest-900">Games</p>
              <label className="flex items-center gap-3 rounded-lg border border-charcoal-400/15 p-3 text-base text-charcoal-700">
                <input
                  type="radio"
                  name="gameChoiceUi"
                  checked={gameChoice === "none"}
                  onChange={() => setGameChoice("none")}
                  className="h-5 w-5 accent-forest-700"
                />
                Just Keep Score
              </label>
              {presets.map((p) => (
                <label key={p.id} className="flex items-center gap-3 rounded-lg border border-charcoal-400/15 p-3 text-base text-charcoal-700">
                  <input
                    type="radio"
                    name="gameChoiceUi"
                    checked={gameChoice === p.id}
                    onChange={() => setGameChoice(p.id)}
                    className="h-5 w-5 accent-forest-700"
                  />
                  {p.name}
                </label>
              ))}
              <ButtonLink href={`/groups/${groupId}`} variant="ghost" size="sm">
                Choose another game after starting
              </ButtonLink>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardContent className="space-y-2 p-5">
              <p className="text-base font-medium text-forest-900">Ready to play</p>
              <dl className="space-y-1 text-sm text-charcoal-600">
                <div className="flex justify-between">
                  <dt>Course</dt>
                  <dd>{course?.name}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Golfers</dt>
                  <dd>{selectedMembers.length}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Game</dt>
                  <dd>{selectedPreset ? selectedPreset.name : "Just Keep Score"}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <div className="mt-4 flex gap-2">
            <Button type="button" variant="outline" size="lg" className="flex-1" onClick={() => setStep(2)}>
              Back
            </Button>
            <div className="flex-[2]">
              <SubmitButton />
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
