"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { startFastGroupRoundAction } from "@/actions/group-rounds";
import type { ActionState } from "@/actions/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

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
}: {
  groupId: string;
  members: Member[];
  recentCourses: RecentCourse[];
  presets: Preset[];
}) {
  const [step, setStep] = useState(0);
  const [courseId, setCourseId] = useState(recentCourses[0]?.id ?? "");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(members.map((m) => m.id)));
  const [drafts, setDrafts] = useState<Record<string, PlayerDraft>>({});
  const [gameChoice, setGameChoice] = useState<string>("none");

  const action = startFastGroupRoundAction.bind(null, groupId);
  const [state, formAction] = useActionState(action, initialState);

  const course = recentCourses.find((c) => c.id === courseId) ?? recentCourses[0];
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
            <ButtonLink href="/play" variant="ghost" size="sm">
              Play somewhere else instead
            </ButtonLink>
            <Button size="lg" className="w-full" onClick={() => setStep(1)} disabled={!courseId}>
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
