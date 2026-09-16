"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { addRoundPlayerAction, addNewGolferToRoundAction } from "@/actions/rounds";
import type { ActionState } from "@/actions/auth";
import type { SnapshotTeeSet } from "@/components/rounds/mobile-scorecard";
import { courseHandicapForTee, findTeeSetByName } from "@/lib/golf/handicap";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { InfoTip } from "@/components/ui/info-tip";
import { cn } from "@/lib/utils";

const initialState: ActionState = { status: "idle" };

function AddButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
      {pending ? "Adding…" : label}
    </Button>
  );
}

/**
 * The "playingHandicap" text field means two different things depending
 * on who's being added, so it gets two different labels/helper text
 * rather than one generic one that would conflate a Handicap Index
 * with a Playing Handicap (see src/lib/golf/handicap.ts):
 *
 * - "override": an existing trip golfer already has a profile Handicap
 *   Index; this field is an optional manual override of the final
 *   Playing Handicap the server would otherwise calculate for them.
 * - "index": a brand-new walk-up golfer has no profile to snapshot a
 *   Handicap Index from, so this field *is* their Handicap Index for
 *   this round, and gets converted to a Course Handicap the same way.
 */
function HandicapField({ mode, teeSetName, teeSets }: { mode: "override" | "index"; teeSetName: string; teeSets: SnapshotTeeSet[] }) {
  const [value, setValue] = useState("");
  const selectedTee = useMemo(() => findTeeSetByName(teeSets, teeSetName || null), [teeSets, teeSetName]);
  const previewIndex = mode === "index" && value ? Number(value) : null;
  const previewCourseHandicap =
    mode === "index" && previewIndex != null && !Number.isNaN(previewIndex)
      ? courseHandicapForTee(previewIndex, selectedTee)
      : null;

  return (
    <div>
      <label htmlFor="playingHandicap" className="mb-1 flex items-center gap-1 text-sm font-medium text-forest-900">
        {mode === "index" ? "Handicap Index" : "Playing handicap override"}
        <InfoTip label={mode === "index" ? "What is a Handicap Index?" : "What is a playing handicap override?"}>
          {mode === "index"
            ? "A portable Handicap Index. Pick a tee above and this will be converted into a Course Handicap for this round."
            : "Optional. Leave blank to use the Course Handicap calculated from their profile Handicap Index and the selected tee. Typing a number here overrides that calculation for this round only."}
        </InfoTip>
      </label>
      <input
        id="playingHandicap"
        name="playingHandicap"
        placeholder={mode === "index" ? "e.g. 12.4" : "Auto from profile + tee"}
        inputMode="decimal"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-11 w-full rounded-lg border border-charcoal-400/25 bg-white px-3 text-base focus:border-forest-600"
      />
      {mode === "index" && teeSetName && (
        <p className="mt-1 text-xs text-charcoal-400">
          {previewCourseHandicap != null
            ? `Course Handicap: ${previewCourseHandicap}`
            : value
              ? "Rating and slope are missing for this tee — this will be used as a manual Playing Handicap instead."
              : ""}
        </p>
      )}
    </div>
  );
}

function TeesField({
  teeSets,
  value,
  onChange,
}: {
  teeSets: SnapshotTeeSet[];
  value: string;
  onChange: (name: string) => void;
}) {
  if (teeSets.length === 0) return null;
  return (
    <div>
      <label htmlFor="teeSetName" className="mb-1 flex items-center gap-1 text-base font-medium text-forest-900">
        Choose tee
        <InfoTip label="Rating / Slope">
          Course Rating and Slope Rating come from the tee picked here, and are what turn a
          Handicap Index into a Course Handicap for this round.
        </InfoTip>
      </label>
      <select
        id="teeSetName"
        name="teeSetName"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-lg border border-charcoal-400/25 bg-white px-3 text-base text-charcoal focus:border-forest-600"
      >
        <option value="">Not set</option>
        {teeSets.map((t) => (
          <option key={t.name} value={t.name}>
            {t.name}
            {t.total_yards ? ` · ${t.total_yards.toLocaleString()} yds` : ""}
            {t.course_rating != null && t.slope_rating != null
              ? ` · ${t.course_rating.toFixed(1)} / ${t.slope_rating}`
              : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

function ExistingGolferForm({
  roundId,
  availableMembers,
  teeSets,
}: {
  roundId: string;
  availableMembers: { id: string; display_name: string }[];
  teeSets: SnapshotTeeSet[];
}) {
  const action = addRoundPlayerAction.bind(null, roundId);
  const [state, formAction] = useActionState(action, initialState);
  const [teeSetName, setTeeSetName] = useState("");

  return (
    <form action={formAction} className="space-y-3" noValidate>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="tripMemberId" className="mb-1 block text-sm font-medium text-forest-900">
            Golfer
          </label>
          <select
            id="tripMemberId"
            name="tripMemberId"
            required
            defaultValue=""
            className="h-11 w-full rounded-lg border border-charcoal-400/25 bg-white px-3 text-base text-charcoal focus:border-forest-600"
          >
            <option value="" disabled>
              Choose a golfer
            </option>
            {availableMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.display_name}
              </option>
            ))}
          </select>
        </div>
        <TeesField teeSets={teeSets} value={teeSetName} onChange={setTeeSetName} />
        <HandicapField mode="override" teeSetName={teeSetName} teeSets={teeSets} />
      </div>
      <AddButton label="Add Golfer" />
      {state.status === "error" && state.message && <Alert variant="error">{state.message}</Alert>}
    </form>
  );
}

/**
 * The round-page equivalent of the trip's "Add a golfer manually"
 * option: creates a brand-new trip member (no invitation, no login
 * required) and adds them to this round in one step, via
 * addNewGolferToRoundAction. Aimed at a walk-up golfer the captain
 * never invited to the trip at all.
 */
function NewGolferForm({ tripId, roundId, teeSets }: { tripId: string; roundId: string; teeSets: SnapshotTeeSet[] }) {
  const action = addNewGolferToRoundAction.bind(null, tripId, roundId);
  const [state, formAction] = useActionState(action, initialState);
  const [teeSetName, setTeeSetName] = useState("");

  return (
    <form action={formAction} className="space-y-3" noValidate>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="newGolferName" className="mb-1 block text-sm font-medium text-forest-900">
            Name
          </label>
          <input
            id="newGolferName"
            name="displayName"
            type="text"
            required
            placeholder="Golfer's name"
            className="h-11 w-full rounded-lg border border-charcoal-400/25 bg-white px-3 text-base focus:border-forest-600"
          />
          {state.status === "error" && state.fieldErrors?.displayName && (
            <p className="mt-1.5 text-xs text-red-600">{state.fieldErrors.displayName[0]}</p>
          )}
        </div>
        <div>
          <label htmlFor="newGolferEmail" className="mb-1 block text-sm font-medium text-forest-900">
            Email (optional)
          </label>
          <input
            id="newGolferEmail"
            name="email"
            type="email"
            placeholder="them@example.com"
            className="h-11 w-full rounded-lg border border-charcoal-400/25 bg-white px-3 text-base focus:border-forest-600"
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <TeesField teeSets={teeSets} value={teeSetName} onChange={setTeeSetName} />
        <HandicapField mode="index" teeSetName={teeSetName} teeSets={teeSets} />
      </div>
      <p className="text-xs text-charcoal-400">
        They&apos;ll be added to this trip as an active golfer right away — no email or sign-up
        needed. You can send them a real invite later if they want their own login.
      </p>
      <AddButton label="Add Golfer" />
      {state.status === "error" && state.message && <Alert variant="error">{state.message}</Alert>}
      {state.status === "success" && state.message && <Alert variant="success">{state.message}</Alert>}
    </form>
  );
}

export function AddRoundPlayerForm({
  tripId,
  roundId,
  availableMembers,
  teeSets,
}: {
  tripId: string;
  roundId: string;
  availableMembers: { id: string; display_name: string }[];
  teeSets: SnapshotTeeSet[];
}) {
  const hasExisting = availableMembers.length > 0;
  const [mode, setMode] = useState<"existing" | "new">(hasExisting ? "existing" : "new");

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-forest-900">Add a golfer to this round</p>

      {hasExisting && (
        <div className="flex gap-1 rounded-full bg-cream-100 p-1 sm:w-fit">
          {(
            [
              ["existing", "Trip golfer"],
              ["new", "New golfer"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className={cn(
                "flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors sm:flex-none",
                mode === key ? "bg-white text-forest-900 shadow-sm" : "text-charcoal-500 hover:text-forest-800",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {mode === "existing" && hasExisting ? (
        <ExistingGolferForm roundId={roundId} availableMembers={availableMembers} teeSets={teeSets} />
      ) : (
        <NewGolferForm tripId={tripId} roundId={roundId} teeSets={teeSets} />
      )}
    </div>
  );
}
