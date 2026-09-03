"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { MoreVertical, Check } from "lucide-react";
import { updateRoundPlayerAction, removeRoundPlayerAction } from "@/actions/rounds";
import type { Tables } from "@/lib/supabase/database.types";
import { Badge } from "@/components/ui/badge";
import { InfoTip } from "@/components/ui/info-tip";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * One golfer's setup card on the Players step. Autosaves each field
 * (select changes save immediately; the handicap text field saves on
 * blur) and shows a small "Saved" confirmation instead of a per-card
 * Save button, so the only button on the whole step is the single
 * bottom "Save Players & Continue" action -- everything above it is
 * already saved by the time a captain reaches it. Destructive removal
 * moved off an always-visible red text link and into a "Player
 * options" menu with a real confirmation dialog.
 */
export function RoundPlayerRow({
  roundId,
  player,
  displayName,
  teeSetNames,
  groups,
  canEdit,
  canRemove,
}: {
  roundId: string;
  player: Tables<"round_players">;
  displayName: string;
  teeSetNames: string[];
  groups: Tables<"round_groups">[];
  canEdit: boolean;
  canRemove: boolean;
}) {
  const [teeSetName, setTeeSetName] = useState(player.tee_set_name ?? "");
  const [playingHandicap, setPlayingHandicap] = useState(
    player.playing_handicap != null ? String(player.playing_handicap) : "",
  );
  const [groupId, setGroupId] = useState(player.group_id ?? "");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removed, setRemoved] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const savedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  function save(next: { teeSetName?: string; playingHandicap?: string; groupId?: string }) {
    const formData = new FormData();
    formData.set("teeSetName", next.teeSetName ?? teeSetName);
    formData.set("playingHandicap", next.playingHandicap ?? playingHandicap);
    formData.set("groupId", next.groupId ?? groupId);
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
          <p className="text-base font-medium text-forest-900">{displayName}</p>
          {player.profile_handicap_index != null && (
            <p className="mt-0.5 text-xs text-charcoal-400">
              Profile handicap when added: {player.profile_handicap_index.toFixed(1)}
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
                  className="block min-h-11 w-full px-4 py-2.5 text-left text-sm text-red-700 hover:bg-red-50"
                >
                  Remove from round
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {canEdit ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {teeSetNames.length > 0 && (
            <div>
              <label className="mb-1 block text-sm font-medium text-forest-900">Tees</label>
              <select
                value={teeSetName}
                onChange={(e) => {
                  setTeeSetName(e.target.value);
                  save({ teeSetName: e.target.value });
                }}
                className="h-11 w-full rounded-lg border border-charcoal-400/25 bg-white px-3 text-base focus:border-forest-600"
              >
                <option value="">Not set</option>
                {teeSetNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1 flex items-center gap-1 text-sm font-medium text-forest-900">
              Playing handicap
              <InfoTip label="What is a playing handicap?">
                The playing handicap is the number used for this round. Changing it here will not
                change the golfer&apos;s profile.
              </InfoTip>
            </label>
            <input
              value={playingHandicap}
              onChange={(e) => setPlayingHandicap(e.target.value)}
              onBlur={() => save({ playingHandicap })}
              inputMode="decimal"
              className="h-11 w-full rounded-lg border border-charcoal-400/25 bg-white px-3 text-base focus:border-forest-600"
            />
          </div>

          {groups.length > 0 && (
            <div>
              <label className="mb-1 block text-sm font-medium text-forest-900">Group</label>
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
        </div>
      ) : (
        <p className="mt-2 text-sm text-charcoal-500">
          {player.tee_set_name ? `${player.tee_set_name} tees` : "Tees not set"}
          {player.playing_handicap != null ? ` · Playing handicap ${player.playing_handicap}` : ""}
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
        confirmLabel="Remove Player"
        cancelLabel="Keep Player"
        onConfirm={async () => {
          await removeRoundPlayerAction(roundId, player.id);
          setRemoved(true);
        }}
      />
    </div>
  );
}
