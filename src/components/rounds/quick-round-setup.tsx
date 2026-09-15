"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { ChevronLeft, ChevronDown, Star, X, Plus } from "lucide-react";
import { startQuickRoundSetupAction } from "@/actions/quick-round";
import { toggleFavoriteCourseAction } from "@/actions/course-favorites";
import { QuickRoundCoursePicker, type SelectedQuickRoundCourse } from "@/components/rounds/quick-round-course-picker";
import { quickPickCourses, type QuickRoundCourseChoice } from "@/lib/golf/quick-round-course-list";
import { GAME_TYPE_LABELS, PRESET_GAME_TYPES, type PresetGameType } from "@/lib/validation/group";
import type { ActionState } from "@/actions/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const initialState: ActionState = { status: "idle" };

interface PlayerDraft {
  key: string;
  kind: "self" | "new";
  displayName: string;
  teeSetName: string;
  playingHandicap: string;
}

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowTimeString(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function autoRoundName(date: Date): string {
  return `Quick Round – ${date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;
}

let draftKeyCounter = 0;
function nextDraftKey(): string {
  draftKeyCounter += 1;
  return `new-golfer-${draftKeyCounter}`;
}

function SubmitButton({
  disabled,
  submittedRef,
}: {
  disabled: boolean;
  submittedRef: React.MutableRefObject<boolean>;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="lg"
      className="w-full"
      disabled={disabled || pending}
      onClick={(e) => {
        // Belt-and-suspenders double-submit guard: useFormStatus's own
        // `pending` already disables this button while the action is in
        // flight, but that flag can lag the very first click by a tick,
        // so a fast double-tap could otherwise fire the action twice and
        // create two round records. This is a client-side guard only --
        // it doesn't survive a page reload or a second browser tab -- so
        // it's a UX safeguard, not a server-side idempotency guarantee.
        if (submittedRef.current) {
          e.preventDefault();
          return;
        }
        submittedRef.current = true;
      }}
    >
      {pending ? "Starting…" : "Start Scoring"}
    </Button>
  );
}

/**
 * The Quick Round single-screen setup (spec: "Simplify only the Quick
 * Round experience ... Replace it with one mobile-first setup screen").
 * Course, players, round options, and an optional game all live here;
 * "Start Scoring" both creates and immediately starts the round, with
 * no separate Review step. Group Round and Trip Round are completely
 * unaffected -- this component, its server action
 * (startQuickRoundSetupAction), and the /play/quick route are all new
 * and additive; nothing about the existing four-step wizard changed.
 */
export function QuickRoundSetup({
  selfDisplayName,
  golfProfile,
  courseChoices,
  courseSearchEnabled,
  manualCourseEntryEnabled,
  sideGamesEnabled,
}: {
  selfDisplayName: string;
  golfProfile: { handicapIndex: number | null; handicapSource: string | null; preferredTee: string | null };
  courseChoices: QuickRoundCourseChoice[];
  courseSearchEnabled: boolean;
  manualCourseEntryEnabled: boolean;
  sideGamesEnabled: boolean;
}) {
  const [state, formAction] = useActionState(startQuickRoundSetupAction, initialState);
  const submittedRef = useRef(false);

  const quickPicks = useMemo(() => quickPickCourses(courseChoices, 4), [courseChoices]);

  function toSelected(c: QuickRoundCourseChoice): SelectedQuickRoundCourse {
    return { id: c.id, name: c.name, city: c.city, state: c.state, holeCount: c.holeCount, teeSetNames: c.teeSetNames };
  }

  const [selectedCourse, setSelectedCourse] = useState<SelectedQuickRoundCourse | null>(() => {
    const first = quickPicks[0];
    return first ? toSelected(first) : null;
  });
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(
    () => new Set(courseChoices.filter((c) => c.favorited).map((c) => c.id)),
  );
  const [isTogglingFavorite, startFavoriteTransition] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);

  const [holeCount, setHoleCount] = useState<9 | 18>(18);

  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);
  const [roundName, setRoundName] = useState("");
  const [roundDate, setRoundDate] = useState("");
  const [startTime, setStartTime] = useState("");

  useEffect(() => {
    // Computed once on mount rather than in each field's useState
    // initializer -- a client component is still rendered once on the
    // server before hydration, and Date.now() can differ by a moment
    // between those two passes; doing this in an effect keeps the
    // server-rendered markup and the first client render identical, and
    // these are meant to be a one-time default anyway (spec: "Default to
    // Today, current time, 18 holes, automatically generated round
    // name"), never re-computed out from under an edit the golfer makes
    // in More Options afterward.
    const now = new Date();
    setRoundDate(todayString());
    setStartTime(nowTimeString());
    setRoundName(autoRoundName(now));
  }, []);

  function resolveSelfTee(course: SelectedQuickRoundCourse | null): string {
    if (!course) return "";
    if (golfProfile.preferredTee && course.teeSetNames.includes(golfProfile.preferredTee)) {
      return golfProfile.preferredTee;
    }
    return "";
  }

  const [players, setPlayers] = useState<PlayerDraft[]>(() => [
    {
      key: "self",
      kind: "self",
      displayName: selfDisplayName,
      teeSetName: resolveSelfTee(selectedCourse),
      playingHandicap: golfProfile.handicapIndex != null ? String(golfProfile.handicapIndex) : "",
    },
  ]);

  function handleCourseSelected(course: SelectedQuickRoundCourse) {
    setSelectedCourse(course);
    setPlayers((prev) =>
      prev.map((p) => {
        if (p.kind === "self") {
          return { ...p, teeSetName: resolveSelfTee(course) };
        }
        return course.teeSetNames.includes(p.teeSetName) ? p : { ...p, teeSetName: "" };
      }),
    );
  }

  function toggleFavorite() {
    if (!selectedCourse) return;
    const courseId = selectedCourse.id;
    const wasFavorited = favoritedIds.has(courseId);
    setFavoritedIds((prev) => {
      const next = new Set(prev);
      if (wasFavorited) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
    startFavoriteTransition(async () => {
      const result = await toggleFavoriteCourseAction(courseId);
      if (!result.ok) {
        // Roll back the optimistic toggle if the save didn't actually happen.
        setFavoritedIds((prev) => {
          const next = new Set(prev);
          if (wasFavorited) next.add(courseId);
          else next.delete(courseId);
          return next;
        });
      }
    });
  }

  const [addGolferOpen, setAddGolferOpen] = useState(false);
  const [newGolferName, setNewGolferName] = useState("");

  function addGolfer() {
    const name = newGolferName.trim();
    if (!name) return;
    setPlayers((prev) => [
      ...prev,
      { key: nextDraftKey(), kind: "new", displayName: name, teeSetName: "", playingHandicap: "" },
    ]);
    setNewGolferName("");
    setAddGolferOpen(false);
  }

  function removePlayer(key: string) {
    setPlayers((prev) => prev.filter((p) => p.key !== key));
  }

  function updatePlayer(key: string, patch: Partial<PlayerDraft>) {
    setPlayers((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  }

  const [gameDialogOpen, setGameDialogOpen] = useState(false);
  const [gameType, setGameType] = useState<PresetGameType | "">("");

  const playersJson = useMemo(
    () =>
      JSON.stringify(
        players.map((p) => ({
          kind: p.kind,
          displayName: p.displayName,
          teeSetName: p.teeSetName,
          playingHandicap: p.playingHandicap,
        })),
      ),
    [players],
  );

  const canStart = Boolean(selectedCourse) && players.length > 0;

  return (
    <div className="mx-auto max-w-xl pb-28">
      <Link
        href="/play"
        className="-ml-2 mb-2 inline-flex h-11 items-center gap-1 rounded-full px-2 text-base font-medium text-charcoal-600 hover:text-forest-800"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Cancel
      </Link>

      <h1 className="text-2xl">Quick Round</h1>
      <p className="mt-1 text-base text-charcoal-500">Start scoring in just a few taps.</p>

      {state.status === "error" && state.message && (
        <Alert variant="error" className="mt-4">
          {state.message}
        </Alert>
      )}

      <form action={formAction} className="mt-5 space-y-4">
        <input type="hidden" name="courseId" value={selectedCourse?.id ?? ""} />
        <input type="hidden" name="holeCount" value={holeCount} />
        <input type="hidden" name="roundName" value={roundName} />
        <input type="hidden" name="roundDate" value={roundDate} />
        <input type="hidden" name="startTime" value={startTime} />
        <input type="hidden" name="players" value={playersJson} />
        <input type="hidden" name="gameType" value={gameType} />

        {/* Course -- one clean summary card when a course is chosen (name,
            city/state, saved indicator, Change Course), or a single
            Choose Course button when nothing's picked yet. Never both a
            summary card and a separate quick-pick row -- that was the
            duplicate "pill + Choose Course button" the redesign asked
            to remove. */}
        <Card>
          <CardContent className="space-y-3 p-5">
            <p className="text-base font-medium text-forest-900">Course</p>

            {selectedCourse ? (
              <div className="rounded-lg border border-forest-700/20 bg-forest-50 p-3">
                <p className="truncate text-base font-medium text-forest-900">{selectedCourse.name}</p>
                {(selectedCourse.city || selectedCourse.state) && (
                  <p className="truncate text-base text-charcoal-500">
                    {[selectedCourse.city, selectedCourse.state].filter(Boolean).join(", ")}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={toggleFavorite}
                    disabled={isTogglingFavorite}
                    className="inline-flex items-center gap-1 text-base font-medium text-charcoal-600 hover:text-forest-800"
                  >
                    <Star
                      className={cn(
                        "h-4 w-4",
                        favoritedIds.has(selectedCourse.id) ? "fill-gold-400 text-gold-500" : "text-charcoal-400",
                      )}
                      aria-hidden="true"
                    />
                    {favoritedIds.has(selectedCourse.id) ? "Saved" : "Save Course"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className="text-base font-medium text-forest-800 underline underline-offset-2"
                  >
                    Change Course
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-base text-charcoal-500">Choose a course to get started.</p>
                <Button type="button" size="sm" className="text-base" onClick={() => setPickerOpen(true)}>
                  Choose Course
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Players */}
        <Card>
          <CardContent className="space-y-3 p-5">
            <p className="text-base font-medium text-forest-900">Players</p>
            <div className="space-y-2">
              {players.map((p) => (
                <div key={p.key} className="rounded-lg border border-charcoal-400/15 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-base font-medium text-charcoal-800">
                      {p.displayName}
                      {p.kind === "self" && (
                        <span className="ml-1.5 text-base font-normal text-charcoal-400">(You)</span>
                      )}
                    </p>
                    {p.kind === "new" && (
                      <button
                        type="button"
                        onClick={() => removePlayer(p.key)}
                        aria-label={`Remove ${p.displayName}`}
                        className="flex h-11 w-11 items-center justify-center text-charcoal-400 hover:text-red-600"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor={`tee-${p.key}`} className="mb-1 block text-base font-medium text-forest-900">
                        Tee
                      </label>
                      <select
                        id={`tee-${p.key}`}
                        value={p.teeSetName}
                        onChange={(e) => updatePlayer(p.key, { teeSetName: e.target.value })}
                        className="h-11 w-full rounded-lg border border-charcoal-400/25 bg-white px-2 text-base text-charcoal focus:border-forest-600"
                        disabled={!selectedCourse || selectedCourse.teeSetNames.length === 0}
                      >
                        <option value="">No tee</option>
                        {(selectedCourse?.teeSetNames ?? []).map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`handicap-${p.key}`} className="mb-1 block text-base font-medium text-forest-900">
                        Handicap Index (optional)
                      </label>
                      <Input
                        id={`handicap-${p.key}`}
                        type="text"
                        inputMode="decimal"
                        placeholder="e.g. 12.4"
                        className="text-base"
                        value={p.playingHandicap}
                        onChange={(e) => updatePlayer(p.key, { playingHandicap: e.target.value })}
                      />
                    </div>
                  </div>
                  {!p.playingHandicap && (
                    <p className="mt-1.5 text-base text-charcoal-400">
                      No handicap on file — gross scoring will be used.
                    </p>
                  )}
                </div>
              ))}
            </div>

            {addGolferOpen ? (
              <div className="flex items-center gap-2">
                <Input
                  value={newGolferName}
                  onChange={(e) => setNewGolferName(e.target.value)}
                  placeholder="Golfer's name"
                  className="text-base"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addGolfer();
                    }
                  }}
                />
                <Button type="button" size="md" onClick={addGolfer} disabled={!newGolferName.trim()}>
                  Add
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setAddGolferOpen(false);
                    setNewGolferName("");
                  }}
                  aria-label="Cancel adding a golfer"
                  className="flex h-11 w-11 shrink-0 items-center justify-center text-charcoal-400 hover:text-charcoal-700"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <Button type="button" variant="outline" size="sm" className="text-base" onClick={() => setAddGolferOpen(true)}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add Golfer
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Round Options */}
        <Card>
          <CardContent className="space-y-3 p-5">
            <p className="text-base font-medium text-forest-900">Round Options</p>
            <div className="flex gap-2">
              {([9, 18] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setHoleCount(n)}
                  className={cn(
                    "flex h-11 flex-1 items-center justify-center rounded-lg border text-base font-medium transition-colors",
                    holeCount === n
                      ? "border-forest-700 bg-forest-800/[0.08] text-forest-900"
                      : "border-charcoal-400/25 text-charcoal-700",
                  )}
                >
                  {n} Holes
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setMoreOptionsOpen((v) => !v)}
              className="flex h-11 items-center gap-1 text-base font-medium text-forest-800"
              aria-expanded={moreOptionsOpen}
            >
              <ChevronDown
                className={cn("h-4 w-4 transition-transform", moreOptionsOpen && "rotate-180")}
                aria-hidden="true"
              />
              More Options
            </button>

            {moreOptionsOpen && (
              <div className="space-y-3 border-t border-charcoal-400/10 pt-3">
                <div>
                  <label htmlFor="quick-round-name" className="mb-1 block text-base font-medium text-forest-900">
                    Round name
                  </label>
                  <Input id="quick-round-name" className="text-base" value={roundName} onChange={(e) => setRoundName(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="quick-round-date" className="mb-1 block text-base font-medium text-forest-900">
                      Date
                    </label>
                    <Input
                      id="quick-round-date"
                      type="date"
                      className="text-base"
                      value={roundDate}
                      onChange={(e) => setRoundDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="quick-round-time" className="mb-1 block text-base font-medium text-forest-900">
                      Time
                    </label>
                    <Input
                      id="quick-round-time"
                      type="time"
                      className="text-base"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Games */}
        {sideGamesEnabled && (
          <Card>
            <CardContent className="p-5">
              <button
                type="button"
                onClick={() => setGameDialogOpen(true)}
                className="flex w-full items-center justify-between gap-3"
              >
                <span className="text-base font-medium text-forest-900">
                  Game: {gameType ? GAME_TYPE_LABELS[gameType] : "Just Keep Score"}
                </span>
                <span className="text-base font-medium text-forest-800 underline underline-offset-2">Change</span>
              </button>
            </CardContent>
          </Card>
        )}

        {/* Sticky primary action -- the tab bar is hidden on this route
            (primary-nav.tsx) and the feedback button is hidden here too
            (feedback-button.tsx), so this is the only fixed control at
            the bottom of the screen. */}
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-forest-900/10 bg-cream-50/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur md:static md:border-0 md:bg-transparent md:p-0">
          <div className="mx-auto max-w-xl">
            {!selectedCourse && (
              <p className="mb-2 text-center text-base text-charcoal-500">Choose a course to start scoring.</p>
            )}
            <SubmitButton disabled={!canStart} submittedRef={submittedRef} />
          </div>
        </div>
      </form>

      <QuickRoundCoursePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        courseChoices={courseChoices}
        excludeCourseId={selectedCourse?.id}
        courseSearchEnabled={courseSearchEnabled}
        manualCourseEntryEnabled={manualCourseEntryEnabled}
        onSelect={handleCourseSelected}
      />

      <Dialog open={gameDialogOpen} onClose={() => setGameDialogOpen(false)} title="Choose a game">
        <div className="space-y-2">
          <label className="flex items-center gap-3 rounded-lg border border-charcoal-400/15 p-3 text-base text-charcoal-700">
            <input
              type="radio"
              name="gameChoiceUi"
              checked={gameType === ""}
              onChange={() => {
                setGameType("");
                setGameDialogOpen(false);
              }}
              className="h-5 w-5 accent-forest-700"
            />
            Just Keep Score
          </label>
          {PRESET_GAME_TYPES.map((g) => (
            <label
              key={g}
              className="flex items-center gap-3 rounded-lg border border-charcoal-400/15 p-3 text-base text-charcoal-700"
            >
              <input
                type="radio"
                name="gameChoiceUi"
                checked={gameType === g}
                onChange={() => {
                  setGameType(g);
                  setGameDialogOpen(false);
                }}
                className="h-5 w-5 accent-forest-700"
              />
              {GAME_TYPE_LABELS[g]}
            </label>
          ))}
        </div>
        <p className="mt-3 text-base text-charcoal-400">
          You can add or change games from the scorecard once the round begins.
        </p>
      </Dialog>
    </div>
  );
}
