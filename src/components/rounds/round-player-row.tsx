"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { MoreVertical, Check } from "lucide-react";
import { updateRoundPlayerAction, removeRoundPlayerAction } from "@/actions/rounds";
import type { Tables } from "@/lib/supabase/database.types";
import type { SnapshotTeeSet } from "@/components/rounds/mobile-scorecard";
import { courseHandicapForTee, findTeeSetByName } from "@/lib/golf/handicap";
import { Badge } from "@/components/ui/badge";
import { InfoTip } from "@/components/ui/info-tip";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TEAM_COLORS, TEAM_COLOR_SWATCH, TEAM_COLOR_LABEL, type PlayerTeamColor } from "@/components/rounds/team-colors";
import { cn } from "@/lib/utils";

type SaveState = "idle" | "saving" | "saved" | "error";
type HandicapSource = "calculated" | "manual" | "legacy";

function teeLabel(tee: SnapshotTeeSet): string {
  const parts = [tee.name];
  if (tee.total_yards) parts.push(`${tee.total_yards.toLocaleString()} yds`);
  if (tee.course_rating != null && tee.slope_rating != null) {
    parts.push(`${tee.course_rating.toFixed(1)} / ${tee.slope_rating}`);
  }
  return parts.join(" · ");
}

/**
 * One golfer's setup card on the Players step. Autosaves each field
 * (select changes save immediately; the handicap text field saves on
 * blur) and shows a small "Saved" confirmation instead of a per-card
 * Save button, so the only button on the whole step is the single
 * bottom "Save Players & Continue" action -- everything above it is
 * already saved by the time a captain reaches it. Destructive removal
 * moved off an always-visible red text link and into a "Player
 * options" menu with a real confirmation dialog.
 *
 * Handicap panel: shows the golfer's snapshot Handicap Index, the
 * selected tee's Rating/Slope, and the Course Handicap calculated from
 * them (see src/lib/golf/handicap.ts -- the same pure function the
 * server uses, so this preview always matches what gets saved). An
 * organizer can override the final Playing Handicap manually; a tee
 * change never silently clears that override (it only recalculates
 * when the source is "calculated").
 */
export function RoundPlayerRow({
  roundId,
  player,
  displayName,
  teeSets,
  groups,
  canEdit,
  canRemove,
}: {
  roundId: string;
  player: Tables<"round_players">;
  displayName: string;
  teeSets: SnapshotTeeSet[];
  groups: Tables<"round_groups">[];
  canEdit: boolean;
  canRemove: boolean;
}) {
  const [teeSetName, setTeeSetName] = useState(player.tee_set_name ?? "");
  const [handicapSource, setHandicapSource] = useState<HandicapSource>(
    (player.playing_handicap_source as HandicapSource | null) ?? "legacy",
  );
  const [manualValue, setManualValue] = useState(
    player.playing_handicap != null ? String(player.playing_handicap) : "",
  );
  const [groupId, setGroupId] = useState(player.group_id ?? "");
  const [teamColor, setTeamColor] = useState<PlayerTeamColor | "">(player.team_color ?? "");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removed, setRemoved] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const savedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handicapIndex = player.profile_handicap_index;
  const selectedTee = useMemo(() => findTeeSetByName(teeSets, teeSetName || null), [teeSets, teeSetName]);
  const calculatedCourseHandicap = useMemo(
    () => courseHandicapForTee(handicapIndex, selectedTee),
    [handicapIndex, selectedTee],
  );
  const missingRatingSlope = Boolean(
    teeSetName && selectedTee && (selectedTee.course_rating == null || selectedTee.slope_rating == null),
  );
  const isManual = handicapSource === "manual";
  // "legacy" rows (saved before this feature existed) behave like
  // "calculated" for display purposes -- there's nothing to distinguish
  // them from a fresh calculation once a tee and index are present.
  const finalPlayingHandicap = isManual
    ? manualValue
      ? Number(manualValue)
      : null
    : calculatedCourseHandicap;

  useEffect(() => {
    if (!menuOpen) return;
    function onDocPointer(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocPointer);
    return () => document.removeEventListener("mousedown", onDocPointer);
  }, [menuOpen]);

  useEffect(() => {
    return () => {
      if (savedTimeout.current) clearTimeout(savedTimeout.current);
    };
  }, []);

  if (removed) return null;

  function save(next: {
    teeSetName?: string;
    manualValue?: string;
    handicapSource?: HandicapSource;
    groupId?: string;
    teamColor?: PlayerTeamColor | "";
  }) {
    const nextSource = next.handicapSource ?? handicapSource;
    const formData = new FormData();
    formData.set("teeSetName", next.teeSetName ?? teeSetName);
    formData.set("playingHandicap", next.manualValue ?? manualValue);
    // "legacy" is a display-only bucket for pre-existing rows -- once a
    // captain touches anything on this card we tell the server to
    // calculate, same as a brand-new row, unless they've explicitly
    // switched to manual.
    formData.set("handicapSource", nextSource === "manual" ? "manual" : "calculated");
    formData.set("groupId", next.groupId ?? groupId);
    formData.set("teamColor", next.teamColor ?? teamColor);
    setSaveState("saving");
    setSaveError(null);
    startTransition(async () => {
      const result = await updateRoundPlayerAction(roundId, player.id, { status: "idle" }, formData);
      if (result.status === "error") {
        setSaveState("error");
        setSaveError(result.message ?? "Couldn't save that. Please try again.");
        return;
      }
      setSaveState("saved");
      if (savedTimeout.current) clearTimeout(savedTimeout.current);
      savedTimeout.current = setTimeout(() => setSaveState("idle"), 2500);
    });
  }

  return (
    <div className="rounded-xl border border-charcoal-400/15 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 font-serif text-lg text-forest-900">
            {displayName}
            {teamColor && (
              <>
                <span
                  aria-hidden="true"
                  className={cn("h-2.5 w-2.5 rounded-full border border-black/10", TEAM_COLOR_SWATCH[teamColor])}
                />
                <span className="sr-only">Team: {TEAM_COLOR_LABEL[teamColor]}</span>
              </>
            )}
          </h3>
          {player.profile_handicap_index != null && (
            <p className="mt-0.5 text-xs text-charcoal-400">
              Handicap Index when added: {player.profile_handicap_index.toFixed(1)}
              {player.profile_handicap_source === "ghin_screenshot_import" ? (
                <Badge variant="forest" className="ml-1.5">
                  GHIN import
                </Badge>
              ) : null}
            </p>
          )}
        </div>

        {canRemove && (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={`Player options for ${displayName}`}
              className="flex h-11 w-11 items-center justify-center rounded-full text-charcoal-400 hover:bg-cream-100 hover:text-charcoal-700"
            >
              <MoreVertical className="h-5 w-5" aria-hidden="true" />
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-lg border border-forest-900/10 bg-white shadow-lg"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirmOpen(true);
                  }}
                  className="block min-h-11 w-full px-4 py-2.5 text-left text-base text-red-700 hover:bg-red-50"
                >
                  Remove Golfer
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {canEdit ? (
        <>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {teeSets.length > 0 && (
              <div>
                <label className="mb-1 flex items-center gap-1 text-base font-medium text-forest-900">
                  Choose tee
                  <InfoTip label="Rating / Slope">
                    Course Rating and Slope Rating come from the tee you pick, and are what turn a
                    Handicap Index into a Course Handicap for this round.
                  </InfoTip>
                </label>
                <select
                  value={teeSetName}
                  onChange={(e) => {
                    const nextName = e.target.value;
                    setTeeSetName(nextName);
                    save({ teeSetName: nextName });
                  }}
                  className="h-11 w-full rounded-lg border border-charcoal-400/25 bg-white px-3 text-base focus:border-forest-600"
                >
                  <option value="">Not set</option>
                  {teeSets.map((t) => (
                    <option key={t.name} value={t.name}>
                      {teeLabel(t)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {groups.length > 0 && (
              <div>
                <label className="mb-1 block text-base font-medium text-forest-900">Playing group</label>
                <select
                  value={groupId}
                  onChange={(e) => {
                    setGroupId(e.target.value);
                    save({ groupId: e.target.value });
                  }}
                  className="h-11 w-full rounded-lg border border-charcoal-400/25 bg-white px-3 text-base focus:border-forest-600"
                >
                  <option value="">Choose a group</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="mb-1 block text-base font-medium text-forest-900">Team</label>
              <div className="relative">
                <span
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border",
                    teamColor ? cn(TEAM_COLOR_SWATCH[teamColor], "border-black/10") : "border-dashed border-charcoal-400/40",
                  )}
                />
                <select
                  value={teamColor}
                  onChange={(e) => {
                    const next = e.target.value as PlayerTeamColor | "";
                    setTeamColor(next);
                    save({ teamColor: next });
                  }}
                  className="h-11 w-full rounded-lg border border-charcoal-400/25 bg-white py-0 pl-8 pr-3 text-base focus:border-forest-600"
                >
                  <option value="">No team</option>
                  {TEAM_COLORS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-lg bg-cream-100 p-3">
            {teeSetName && missingRatingSlope && (
              <p className="mb-2 text-sm text-amber-800">
                Rating and slope are missing for this tee. Add them to calculate a Course
                Handicap, or enter a Playing Handicap manually.
              </p>
            )}
            {!teeSetName && teeSets.length > 0 && (
              <p className="mb-2 text-sm text-charcoal-500">
                Choose a tee above to calculate a Course Handicap.
              </p>
            )}

            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm sm:grid-cols-4">
              <div>
                <p className="text-charcoal-400">Handicap Index</p>
                <p className="font-medium text-forest-900">{handicapIndex != null ? handicapIndex.toFixed(1) : "—"}</p>
              </div>
              <div>
                <p className="text-charcoal-400">Rating / Slope</p>
                <p className="font-medium text-forest-900">
                  {selectedTee && selectedTee.course_rating != null && selectedTee.slope_rating != null
                    ? `${selectedTee.course_rating.toFixed(1)} / ${selectedTee.slope_rating}`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-charcoal-400">Course Handicap</p>
                <p className="font-medium text-forest-900">
                  {calculatedCourseHandicap != null ? calculatedCourseHandicap : "—"}
                </p>
              </div>
              <div>
                <p className="text-charcoal-400">Playing Handicap</p>
                <p className="font-medium text-forest-900">
                  {finalPlayingHandicap != null ? finalPlayingHandicap : "—"}
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant={isManual ? "gold" : "forest"}>
                {isManual ? "Manual override" : "Calculated from index and tee"}
              </Badge>

              {!isManual && (
                <button
                  type="button"
                  onClick={() => {
                    setHandicapSource("manual");
                    setManualValue(calculatedCourseHandicap != null ? String(calculatedCourseHandicap) : "");
                  }}
                  className="text-sm font-medium text-forest-700 underline underline-offset-2 hover:text-forest-900"
                >
                  Override
                </button>
              )}

              {isManual && (
                <>
                  <input
                    aria-label="Manual playing handicap"
                    value={manualValue}
                    onChange={(e) => setManualValue(e.target.value)}
                    onBlur={() => save({ manualValue, handicapSource: "manual" })}
                    inputMode="decimal"
                    placeholder="Enter Playing Handicap"
                    className="h-11 w-40 rounded-lg border border-charcoal-400/25 bg-white px-3 text-base focus:border-forest-600"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setHandicapSource("calculated");
                      save({ handicapSource: "calculated" });
                    }}
                    className="text-sm font-medium text-forest-700 underline underline-offset-2 hover:text-forest-900"
                  >
                    Revert to calculated
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      ) : (
        <p className="mt-2 text-base text-charcoal-500">
          {player.tee_set_name ? `${player.tee_set_name} tees` : "Tee not set"}
          {player.playing_handicap != null ? ` · Playing handicap ${player.playing_handicap}` : ""}
          {teamColor ? ` · Team: ${TEAM_COLOR_LABEL[teamColor]}` : ""}
        </p>
      )}

      {canEdit && (
        <div className="mt-2 min-h-[1.25rem] text-xs">
          {saveState === "saving" && <span className="text-charcoal-400">Saving…</span>}
          {saveState === "saved" && (
            <span className="inline-flex items-center gap-1 text-forest-700">
              <Check className="h-3.5 w-3.5" aria-hidden="true" /> Changes saved
            </span>
          )}
          {saveState === "error" && <span className="text-red-600">{saveError}</span>}
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Remove ${displayName} from this round?`}
        description={`${displayName} will remain on the trip but will be removed from this round.`}
        confirmLabel="Remove Golfer"
        cancelLabel="Keep Golfer"
        onConfirm={async () => {
          await removeRoundPlayerAction(roundId, player.id);
          setRemoved(true);
        }}
      />
    </div>
  );
}
