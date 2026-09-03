"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { saveHoleScoreAction, startRoundAction, lockRoundAction } from "@/actions/scores";
import { allocateStrokes, netScore } from "@/lib/golf/handicap";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/supabase/database.types";

type RoundStatus = Database["public"]["Enums"]["round_status"];
type ScoreEditScope = Database["public"]["Enums"]["round_score_edit_scope"];

export type ScorecardPlayer = {
  roundPlayerId: string;
  displayName: string;
  userId: string | null;
  groupId: string | null;
  teeSetName: string | null;
  playingHandicap: number | null;
};

export type SnapshotHole = {
  hole_number: number;
  par: number;
  yardage: number | null;
  stroke_index: number | null;
};

export type SnapshotTeeSet = { name: string; holes: SnapshotHole[] };

type SyncStatus = "synced" | "pending" | "error";
type ScoreKey = string;

function scoreKey(roundPlayerId: string, holeNumber: number): ScoreKey {
  return `${roundPlayerId}:${holeNumber}`;
}

export function MobileScorecard({
  tripId,
  roundId,
  roundStatus,
  scoreEditScope,
  holeCount,
  teeSets,
  players,
  initialScores,
  currentUserId,
  isCaptain,
}: {
  tripId: string;
  roundId: string;
  roundStatus: RoundStatus;
  scoreEditScope: ScoreEditScope;
  holeCount: number;
  teeSets: SnapshotTeeSet[];
  players: ScorecardPlayer[];
  initialScores: { roundPlayerId: string; holeNumber: number; grossStrokes: number | null }[];
  currentUserId: string;
  isCaptain: boolean;
}) {
  const myPlayer = players.find((p) => p.userId === currentUserId) ?? null;

  const editableIds = useMemo(() => {
    if (isCaptain) return new Set(players.map((p) => p.roundPlayerId));
    const ids = new Set<string>();
    if (myPlayer) {
      ids.add(myPlayer.roundPlayerId);
      if (scoreEditScope === "per_group" && myPlayer.groupId) {
        for (const p of players) {
          if (p.groupId === myPlayer.groupId) ids.add(p.roundPlayerId);
        }
      }
    }
    return ids;
  }, [isCaptain, myPlayer, players, scoreEditScope]);

  const editablePlayers = players.filter((p) => editableIds.has(p.roundPlayerId));
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>(
    myPlayer?.roundPlayerId ?? editablePlayers[0]?.roundPlayerId ?? players[0]?.roundPlayerId ?? "",
  );
  const [currentHole, setCurrentHole] = useState(1);

  const [scores, setScores] = useState<Map<ScoreKey, number | null>>(() => {
    const map = new Map<ScoreKey, number | null>();
    for (const s of initialScores) {
      map.set(scoreKey(s.roundPlayerId, s.holeNumber), s.grossStrokes);
    }
    return map;
  });
  const [syncStatus, setSyncStatus] = useState<Map<ScoreKey, SyncStatus>>(new Map());
  const saveTimers = useRef<Map<ScoreKey, ReturnType<typeof setTimeout>>>(new Map());
  const [isLocking, setIsLocking] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const isLocked = roundStatus === "locked" || roundStatus === "completed";

  const holesByTeeSet = useMemo(() => {
    const byName = new Map<string, SnapshotHole[]>();
    for (const ts of teeSets) byName.set(ts.name, ts.holes);
    return byName;
  }, [teeSets]);

  function strokesTableFor(playerId: string): Map<number, number | null> {
    const player = players.find((p) => p.roundPlayerId === playerId);
    if (!player || player.playingHandicap == null) return new Map();
    const holes = player.teeSetName ? (holesByTeeSet.get(player.teeSetName) ?? []) : teeSets[0]?.holes ?? [];
    return allocateStrokes(
      player.playingHandicap,
      holes.map((h) => ({ holeNumber: h.hole_number, strokeIndex: h.stroke_index })),
    );
  }

  const persist = useCallback(
    (roundPlayerId: string, holeNumber: number, value: number | null) => {
      const key = scoreKey(roundPlayerId, holeNumber);
      const existing = saveTimers.current.get(key);
      if (existing) clearTimeout(existing);

      setSyncStatus((prev) => new Map(prev).set(key, "pending"));

      const timer = setTimeout(async () => {
        if (!navigator.onLine) {
          setSyncStatus((prev) => new Map(prev).set(key, "error"));
          return;
        }
        const result = await saveHoleScoreAction(roundId, roundPlayerId, holeNumber, value);
        setSyncStatus((prev) => new Map(prev).set(key, result.ok ? "synced" : "error"));
      }, 350);

      saveTimers.current.set(key, timer);
    },
    [roundId],
  );

  // Retry every score still marked "error" as soon as the device comes
  // back online -- the offline-friendly part of "offline-friendly entry
  // with automatic sync on reconnect." Pending writes only live in this
  // component's state for as long as the tab stays open; there's no
  // durable (IndexedDB-backed) queue behind this yet, which is a real
  // limitation for a golfer who closes the app mid-round with unsynced
  // holes -- worth flagging rather than silently claiming full offline
  // support.
  useEffect(() => {
    function retryAll() {
      setSyncStatus((prev) => {
        const next = new Map(prev);
        for (const [key, status] of prev) {
          if (status !== "error") continue;
          const [roundPlayerId, holeStr] = key.split(":");
          const holeNumber = Number(holeStr);
          const value = scores.get(key) ?? null;
          next.set(key, "pending");
          saveHoleScoreAction(roundId, roundPlayerId, holeNumber, value).then((result) => {
            setSyncStatus((p) => new Map(p).set(key, result.ok ? "synced" : "error"));
          });
        }
        return next;
      });
    }
    window.addEventListener("online", retryAll);
    return () => window.removeEventListener("online", retryAll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundId]);

  function setScore(roundPlayerId: string, holeNumber: number, value: number | null) {
    const key = scoreKey(roundPlayerId, holeNumber);
    setScores((prev) => new Map(prev).set(key, value));
    persist(roundPlayerId, holeNumber, value);
  }

  const selectedPlayer = players.find((p) => p.roundPlayerId === selectedPlayerId);
  const canEditSelected = selectedPlayer != null && editableIds.has(selectedPlayer.roundPlayerId) && !isLocked;
  const selectedHoles = selectedPlayer?.teeSetName
    ? (holesByTeeSet.get(selectedPlayer.teeSetName) ?? [])
    : (teeSets[0]?.holes ?? []);
  const holeInfo = selectedHoles.find((h) => h.hole_number === currentHole);
  const selectedStrokes = selectedPlayer ? strokesTableFor(selectedPlayer.roundPlayerId) : new Map();
  const strokesOnCurrentHole = selectedStrokes.get(currentHole) ?? null;
  const currentGross = selectedPlayer
    ? (scores.get(scoreKey(selectedPlayer.roundPlayerId, currentHole)) ?? null)
    : null;
  const currentNet = netScore(currentGross, strokesOnCurrentHole);
  const currentKey = selectedPlayer ? scoreKey(selectedPlayer.roundPlayerId, currentHole) : "";
  const currentSync = syncStatus.get(currentKey);

  function totalsFor(playerId: string) {
    let frontGross = 0;
    let frontCount = 0;
    let backGross = 0;
    let backCount = 0;
    for (let h = 1; h <= holeCount; h++) {
      const g = scores.get(scoreKey(playerId, h));
      if (g == null) continue;
      if (h <= 9) {
        frontGross += g;
        frontCount++;
      } else {
        backGross += g;
        backCount++;
      }
    }
    return {
      front: frontCount > 0 ? frontGross : null,
      back: backCount > 0 ? backGross : null,
      total: frontCount + backCount > 0 ? frontGross + backGross : null,
      holesPlayed: frontCount + backCount,
    };
  }

  const standings = players
    .map((p) => ({ player: p, totals: totalsFor(p.roundPlayerId) }))
    .filter((s) => s.totals.holesPlayed > 0)
    .sort((a, b) => (a.totals.total ?? Infinity) - (b.totals.total ?? Infinity));

  const selectedTotals = selectedPlayer ? totalsFor(selectedPlayer.roundPlayerId) : null;

  function adjustScore(delta: number) {
    if (!selectedPlayer || !canEditSelected) return;
    const base = currentGross ?? holeInfo?.par ?? 4;
    const next = Math.min(20, Math.max(1, base + delta));
    setScore(selectedPlayer.roundPlayerId, currentHole, next);
  }

  return (
    <div className="space-y-4 pb-safe">
      {actionError && <p className="text-sm text-red-600">{actionError}</p>}

      {roundStatus === "scheduled" && isCaptain && (
        <Button
          variant="outline"
          size="sm"
          disabled={isStarting}
          onClick={() => {
            setIsStarting(true);
            setActionError(null);
            startRoundAction(tripId, roundId).catch((err) => {
              setActionError(err instanceof Error ? err.message : "Couldn't start the round.");
            }).finally(() => setIsStarting(false));
          }}
        >
          {isStarting ? "Starting…" : "Start round"}
        </Button>
      )}

      {isLocked && (
        <Badge variant="neutral">This round is {roundStatus === "locked" ? "locked" : "completed"} — scores can no longer be edited.</Badge>
      )}

      {/* Player switcher — a horizontal, thumb-scrollable row rather than
          a dropdown, since the whole point of the mobile scorecard is
          minimal taps: whoever's entering (often the captain, for a
          whole group) just taps a name instead of opening a menu. */}
      {players.length > 1 && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {players.map((p) => (
            <button
              key={p.roundPlayerId}
              type="button"
              onClick={() => setSelectedPlayerId(p.roundPlayerId)}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
                p.roundPlayerId === selectedPlayerId
                  ? "bg-forest-800 text-cream-50"
                  : "bg-cream-100 text-charcoal-700",
              )}
            >
              {p.displayName}
            </button>
          ))}
        </div>
      )}

      {selectedPlayer && (
        <div className="rounded-2xl border border-forest-900/[0.06] bg-white p-4 shadow-card">
          <div className="flex items-center justify-between">
            <button
              type="button"
              disabled={currentHole <= 1}
              onClick={() => setCurrentHole((h) => Math.max(1, h - 1))}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-cream-100 text-xl text-forest-800 disabled:opacity-30"
              aria-label="Previous hole"
            >
              ‹
            </button>
            <div className="text-center">
              <p className="text-xs font-medium uppercase tracking-wide text-charcoal-400">Hole</p>
              <p className="font-serif text-3xl text-forest-900">{currentHole}</p>
              <p className="text-xs text-charcoal-500">
                Par {holeInfo?.par ?? "—"}
                {holeInfo?.yardage ? ` · ${holeInfo.yardage} yds` : ""}
                {holeInfo?.stroke_index ? ` · SI ${holeInfo.stroke_index}` : ""}
              </p>
            </div>
            <button
              type="button"
              disabled={currentHole >= holeCount}
              onClick={() => setCurrentHole((h) => Math.min(holeCount, h + 1))}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-cream-100 text-xl text-forest-800 disabled:opacity-30"
              aria-label="Next hole"
            >
              ›
            </button>
          </div>

          <div className="mt-6 flex items-center justify-center gap-4">
            <button
              type="button"
              disabled={!canEditSelected}
              onClick={() => adjustScore(-1)}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-cream-100 text-2xl font-medium text-forest-800 active:bg-cream-200 disabled:opacity-30"
              aria-label="Decrease score"
            >
              −
            </button>
            <input
              type="number"
              inputMode="numeric"
              disabled={!canEditSelected}
              value={currentGross ?? ""}
              placeholder={String(holeInfo?.par ?? "")}
              onChange={(e) => {
                if (!selectedPlayer) return;
                const v = e.target.value === "" ? null : Number(e.target.value);
                setScore(selectedPlayer.roundPlayerId, currentHole, v === null ? null : Math.min(20, Math.max(1, v)));
              }}
              className="h-16 w-20 rounded-2xl border border-charcoal-400/25 bg-white text-center font-serif text-3xl text-forest-900 focus:border-forest-600"
            />
            <button
              type="button"
              disabled={!canEditSelected}
              onClick={() => adjustScore(1)}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-cream-100 text-2xl font-medium text-forest-800 active:bg-cream-200 disabled:opacity-30"
              aria-label="Increase score"
            >
              +
            </button>
          </div>

          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-charcoal-400">
            <span>
              {currentNet != null ? `Net ${currentNet}` : "Net —"}
              {strokesOnCurrentHole ? ` (${strokesOnCurrentHole > 0 ? "+" : ""}${strokesOnCurrentHole} hcp)` : ""}
            </span>
            {currentSync === "pending" && <span className="text-amber-600">Saving…</span>}
            {currentSync === "error" && <span className="text-red-600">Not synced — will retry</span>}
            {currentSync === "synced" && <span className="text-emerald-600">Saved</span>}
          </div>

          {selectedTotals && (
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-charcoal-400/10 pt-3 text-center text-sm">
              <div>
                <p className="text-xs text-charcoal-400">Front</p>
                <p className="font-medium text-forest-900">{selectedTotals.front ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-charcoal-400">Back</p>
                <p className="font-medium text-forest-900">{selectedTotals.back ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-charcoal-400">Total</p>
                <p className="font-medium text-forest-900">{selectedTotals.total ?? "—"}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {standings.length > 0 && (
        <div className="rounded-2xl border border-forest-900/[0.06] bg-white p-4 shadow-card">
          <p className="text-xs font-medium uppercase tracking-wide text-charcoal-400">
            Gross totals (thru holes played)
          </p>
          <ul className="mt-2 space-y-1.5">
            {standings.map((s, i) => (
              <li key={s.player.roundPlayerId} className="flex items-center justify-between text-sm">
                <span className="text-charcoal-700">
                  {i + 1}. {s.player.displayName}
                </span>
                <span className="font-medium text-forest-900">
                  {s.totals.total} <span className="text-xs text-charcoal-400">thru {s.totals.holesPlayed}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-charcoal-400">
            Gross totals only — game-format standings (net, match play, skins) come from Games once
            they&apos;re set up.
          </p>
        </div>
      )}

      {isCaptain && roundStatus !== "locked" && roundStatus !== "completed" && (
        <Button
          variant="outline"
          size="sm"
          disabled={isLocking}
          className="border-red-200 text-red-700 hover:bg-red-50"
          onClick={() => {
            if (!window.confirm("Lock this round? No one will be able to change scores after this.")) return;
            setIsLocking(true);
            setActionError(null);
            lockRoundAction(tripId, roundId).catch((err) => {
              setActionError(err instanceof Error ? err.message : "Couldn't lock the round.");
            }).finally(() => setIsLocking(false));
          }}
        >
          {isLocking ? "Locking…" : "Lock round"}
        </Button>
      )}
    </div>
  );
}
