"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { saveHoleScoreAction, startRoundAction, lockRoundAction } from "@/actions/scores";
import { netScore } from "@/lib/golf/handicap";
import {
  strokesReceivedByHole,
  computeStandings,
  type HoleSpec,
  type PlayerScoreInput,
  type StandingsMetric,
} from "@/lib/golf/scoring";
import { computeSkins } from "@/lib/golf/skins";
import { computeSkinsSettlement, dollarsToCents, formatCents, formatSignedCents } from "@/lib/golf/settlement";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { FullScorecardTable } from "@/components/rounds/full-scorecard-table";
import type { Database } from "@/lib/supabase/database.types";

type RoundStatus = Database["public"]["Enums"]["round_status"];
type ScoreEditScope = Database["public"]["Enums"]["round_score_edit_scope"];
type SideGameType = Database["public"]["Enums"]["side_game_type"];

// What the scorecard's game-picker needs for any side game configured on
// this round. Skins gets a full, live-updating view built right from
// the same scores/state this component already tracks (see
// SkinsGameStandings below); every other game type falls back to a
// pointer at the Games/Results tabs rather than re-implementing that
// game's own engine (Nassau presses, wolf picks, Vegas, quota, etc.) a
// second time here.
export type ScorecardSideGame = {
  id: string;
  name: string;
  gameType: SideGameType;
  scoringMetric: "gross" | "net";
  carryover: boolean;
  isMonetary: boolean;
  dollarValue: number | null;
  participantIds: string[];
};

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

export type SnapshotTeeSet = {
  name: string;
  holes: SnapshotHole[];
  // Present when this round's course came from a provider (or a manual
  // entry with rating/slope filled in) -- display-only, same as the rest
  // of this file: scoring (netScore/strokesReceivedByHole/computeStandings)
  // only ever reads par and stroke_index off each hole, never these.
  color?: string | null;
  category?: "male" | "female" | "unisex" | null;
  course_rating?: number | null;
  slope_rating?: number | null;
  total_yards?: number | null;
};

type SyncStatus = "synced" | "pending" | "error";
type ScoreKey = string;

function scoreKey(roundPlayerId: string, holeNumber: number): ScoreKey {
  return `${roundPlayerId}:${holeNumber}`;
}

/**
 * A per-round, localStorage-backed queue of scores entered but not yet
 * confirmed saved -- the durable half of "preserve entered scores if
 * the connection drops and sync when service returns." The in-memory
 * retry-on-`online` behavior already covers a dropped connection while
 * the tab stays open; this covers the harder case of a golfer closing
 * the app (or the tab getting killed) with unsynced holes, by writing
 * through on every edit and replaying whatever's left on next launch.
 * Safe to replay blindly because saveHoleScoreAction upserts on
 * (round_player_id, hole_number) -- resubmitting an already-saved value
 * is a no-op, never a duplicate.
 */
function pendingQueueStorageKey(roundId: string): string {
  return `splitfairway:pending-scores:${roundId}`;
}

function loadPendingQueue(roundId: string): Record<ScoreKey, number | null> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(pendingQueueStorageKey(roundId));
    return raw ? (JSON.parse(raw) as Record<ScoreKey, number | null>) : {};
  } catch {
    return {};
  }
}

function savePendingQueue(roundId: string, queue: Record<ScoreKey, number | null>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(pendingQueueStorageKey(roundId), JSON.stringify(queue));
  } catch {
    // Storage unavailable (private browsing, quota) -- the in-tab
    // retry-on-reconnect below still covers this session.
  }
}

/** Traditional golf term for a score's relation to par -- used only in
 * the skins detail breakdown ("Birdie on 3") below, purely descriptive. */
function relativeScoreLabel(diff: number): string {
  if (diff <= -3) return "Albatross";
  if (diff === -2) return "Eagle";
  if (diff === -1) return "Birdie";
  if (diff === 0) return "Par";
  if (diff === 1) return "Bogey";
  if (diff === 2) return "Double bogey";
  return `+${diff} on par`;
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
  sideGames,
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
  sideGames: ScorecardSideGame[];
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
  const [viewMode, setViewMode] = useState<"hole" | "full">("hole");

  const [scores, setScores] = useState<Map<ScoreKey, number | null>>(() => {
    const map = new Map<ScoreKey, number | null>();
    for (const s of initialScores) {
      map.set(scoreKey(s.roundPlayerId, s.holeNumber), s.grossStrokes);
    }
    return map;
  });
  const [syncStatus, setSyncStatus] = useState<Map<ScoreKey, SyncStatus>>(new Map());
  const saveTimers = useRef<Map<ScoreKey, ReturnType<typeof setTimeout>>>(new Map());
  // Auto-hides each row's "Saved" confirmation a couple seconds after
  // it appears, per the redesign spec -- previously it stuck around
  // until the next edit.
  const hideTimers = useRef<Map<ScoreKey, ReturnType<typeof setTimeout>>>(new Map());
  const pendingQueueRef = useRef<Record<ScoreKey, number | null>>({});

  function scheduleHideSaved(key: ScoreKey) {
    const existing = hideTimers.current.get(key);
    if (existing) clearTimeout(existing);
    hideTimers.current.set(
      key,
      setTimeout(() => {
        setSyncStatus((prev) => {
          if (prev.get(key) !== "synced") return prev;
          const next = new Map(prev);
          next.delete(key);
          return next;
        });
      }, 1800),
    );
  }

  function clearFromPendingQueue(key: ScoreKey) {
    delete pendingQueueRef.current[key];
    savePendingQueue(roundId, pendingQueueRef.current);
  }
  const [isLocking, setIsLocking] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const isLocked = roundStatus === "locked" || roundStatus === "completed";

  const holesByTeeSet = useMemo(() => {
    const byName = new Map<string, SnapshotHole[]>();
    for (const ts of teeSets) byName.set(ts.name, ts.holes);
    return byName;
  }, [teeSets]);

  function holesFor(player: ScorecardPlayer): HoleSpec[] {
    const holes = player.teeSetName ? (holesByTeeSet.get(player.teeSetName) ?? []) : (teeSets[0]?.holes ?? []);
    return holes.map((h) => ({ holeNumber: h.hole_number, par: h.par, strokeIndex: h.stroke_index }));
  }

  function strokesTableFor(playerId: string): Map<number, number | null> {
    const player = players.find((p) => p.roundPlayerId === playerId);
    if (!player) return new Map();
    return strokesReceivedByHole(player.playingHandicap, holesFor(player));
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
        if (result.ok) {
          clearFromPendingQueue(key);
          scheduleHideSaved(key);
        }
      }, 350);

      saveTimers.current.set(key, timer);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            if (result.ok) {
              clearFromPendingQueue(key);
              scheduleHideSaved(key);
            }
          });
        }
        return next;
      });
    }
    window.addEventListener("online", retryAll);
    return () => window.removeEventListener("online", retryAll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundId]);

  // Once on mount: pick up anything left in this device's durable queue
  // from a previous visit -- a golfer who entered scores, lost signal,
  // and closed the app before it reconnected still has them here, and
  // they get folded into local state (so they're visible right away)
  // and replayed to the server if a connection is already available.
  useEffect(() => {
    const queue = loadPendingQueue(roundId);
    pendingQueueRef.current = queue;
    const keys = Object.keys(queue);
    if (keys.length === 0) return;

    setScores((prev) => {
      const next = new Map(prev);
      for (const key of keys) next.set(key, queue[key]);
      return next;
    });
    setSyncStatus((prev) => {
      const next = new Map(prev);
      for (const key of keys) next.set(key, "pending");
      return next;
    });

    if (navigator.onLine) {
      for (const key of keys) {
        const [roundPlayerId, holeStr] = key.split(":");
        saveHoleScoreAction(roundId, roundPlayerId, Number(holeStr), queue[key]).then((result) => {
          setSyncStatus((p) => new Map(p).set(key, result.ok ? "synced" : "error"));
          if (result.ok) {
            clearFromPendingQueue(key);
            scheduleHideSaved(key);
          }
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundId]);

  function setScore(roundPlayerId: string, holeNumber: number, value: number | null) {
    const key = scoreKey(roundPlayerId, holeNumber);
    setScores((prev) => new Map(prev).set(key, value));
    pendingQueueRef.current[key] = value;
    savePendingQueue(roundId, pendingQueueRef.current);
    persist(roundPlayerId, holeNumber, value);
  }

  // The redesign shows every editable golfer's row for the current
  // hole at once (below), rather than one selected golfer at a time --
  // this is just the reference hole/par/yardage shown once at the top,
  // taken from whichever editable golfer's tee set (falling back to the
  // round's first tee set). Par is effectively the same across tees at
  // one course; only yardage and stroke index meaningfully differ, and
  // each row still computes its own strokes-received off its own
  // golfer's tee set and handicap.
  const headerPlayer = editablePlayers[0] ?? players[0];
  const headerHoles = headerPlayer?.teeSetName
    ? (holesByTeeSet.get(headerPlayer.teeSetName) ?? [])
    : (teeSets[0]?.holes ?? []);
  const headerHoleInfo = headerHoles.find((h) => h.hole_number === currentHole);

  // One PlayerScoreInput per player -- the shared engine's unit of
  // input (src/lib/golf/scoring.ts) -- rebuilt whenever a score changes.
  // Each player carries their own tee set's holes, since golfers in the
  // same round can play different tees with different par/stroke index.
  const playerScoreInputs: PlayerScoreInput[] = useMemo(
    () =>
      players.map((p) => {
        const grossByHole = new Map<number, number | null>();
        for (let h = 1; h <= holeCount; h++) {
          grossByHole.set(h, scores.get(scoreKey(p.roundPlayerId, h)) ?? null);
        }
        return {
          roundPlayerId: p.roundPlayerId,
          playingHandicap: p.playingHandicap,
          holes: holesFor(p),
          grossByHole,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [players, scores, holeCount, holesByTeeSet, teeSets],
  );

  const [standingsMetric, setStandingsMetric] = useState<StandingsMetric>("gross");
  const standings = computeStandings(playerScoreInputs, standingsMetric);
  const standingsById = new Map(players.map((p) => [p.roundPlayerId, p]));

  // Which game the Standings card is showing -- "overall" is the
  // always-available Gross/Net/Points view above; picking one of
  // sideGames switches the card over to that game's own results,
  // computed live from the same `scores` state (no page reload needed
  // to see a skins pot update as the last score for a hole comes in).
  const [selectedGameId, setSelectedGameId] = useState<string>("overall");
  const selectedSideGame = sideGames.find((g) => g.id === selectedGameId) ?? null;

  const skinsView = useMemo(() => {
    if (!selectedSideGame || selectedSideGame.gameType !== "skins") return null;
    const game = selectedSideGame;
    const gameHoleNumbers = Array.from({ length: holeCount }, (_, i) => i + 1);
    const gamePlayers = playerScoreInputs.filter((p) => game.participantIds.includes(p.roundPlayerId));
    const gamePlayersById = new Map(gamePlayers.map((p) => [p.roundPlayerId, p]));
    const result = computeSkins(gamePlayers, gameHoleNumbers, game.scoringMetric, game.carryover);
    const settlement =
      game.isMonetary && game.dollarValue != null
        ? computeSkinsSettlement(result, game.participantIds, dollarsToCents(game.dollarValue))
        : null;

    // Which hole each skin was won on, and by whom -- drives both the
    // full scorecard's cell highlight and the "Birdie on 3" breakdown
    // below, built from the same winner the settlement money is
    // already based on (SkinHoleResult#winnerRoundPlayerId).
    const skinWinnerByHole = new Map<number, string>();
    const holesWonByPlayer = new Map<
      string,
      { holeNumber: number; skinsWon: number; label: string | null }[]
    >();
    for (const hole of result.holes) {
      if (!hole.winnerRoundPlayerId) continue;
      skinWinnerByHole.set(hole.holeNumber, hole.winnerRoundPlayerId);
      const winner = gamePlayersById.get(hole.winnerRoundPlayerId);
      const gross = winner?.grossByHole.get(hole.holeNumber) ?? null;
      const par = winner?.holes.find((h) => h.holeNumber === hole.holeNumber)?.par ?? null;
      const label = gross != null && par != null ? relativeScoreLabel(gross - par) : null;
      const list = holesWonByPlayer.get(hole.winnerRoundPlayerId) ?? [];
      list.push({ holeNumber: hole.holeNumber, skinsWon: hole.skinsWon, label });
      holesWonByPlayer.set(hole.winnerRoundPlayerId, list);
    }

    const standings = game.participantIds
      .map((roundPlayerId) => ({
        roundPlayerId,
        displayName: standingsById.get(roundPlayerId)?.displayName ?? "Golfer",
        skinsWon: result.totalsByPlayer.get(roundPlayerId) ?? 0,
        netCents: settlement?.netByPlayer.get(roundPlayerId) ?? null,
        holesWon: (holesWonByPlayer.get(roundPlayerId) ?? []).sort((a, b) => a.holeNumber - b.holeNumber),
      }))
      .sort((a, b) => b.skinsWon - a.skinsWon);
    return { game, result, settlement, standings, skinWinnerByHole };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSideGame, playerScoreInputs, holeCount]);

  // Which skins-standings row is expanded to show its "Birdie on 3"
  // hole-by-hole breakdown -- collapsed by default, and reset whenever
  // the game picker changes so a stale expansion doesn't linger.
  const [expandedSkinsPlayerId, setExpandedSkinsPlayerId] = useState<string | null>(null);
  useEffect(() => {
    setExpandedSkinsPlayerId(null);
  }, [selectedGameId]);

  function adjustScore(player: ScorecardPlayer, delta: number) {
    if (!editableIds.has(player.roundPlayerId) || isLocked) return;
    const holes = player.teeSetName ? (holesByTeeSet.get(player.teeSetName) ?? []) : (teeSets[0]?.holes ?? []);
    const par = holes.find((h) => h.hole_number === currentHole)?.par ?? 4;
    const current = scores.get(scoreKey(player.roundPlayerId, currentHole)) ?? null;
    const base = current ?? par;
    const next = Math.min(20, Math.max(1, base + delta));
    setScore(player.roundPlayerId, currentHole, next);
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
          {isStarting ? "Starting…" : "Start Scoring"}
        </Button>
      )}

      {isLocked && (
        <Badge variant="neutral">This round is {roundStatus === "locked" ? "locked" : "completed"} — scores can no longer be edited.</Badge>
      )}

      {/* Entry vs. full-scorecard toggle. Entering scores one hole at a
          time (below) is what's actually fast on a phone mid-round; the
          full scorecard is the "see everything at once, like a printed
          card" view someone reaches for at the turn or after the round. */}
      <div className="flex gap-1 rounded-full bg-cream-100 p-1">
        {(
          [
            { key: "hole", label: "Enter score" },
            { key: "full", label: "Full scorecard" },
          ] as const
        ).map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setViewMode(opt.key)}
            className={cn(
              "flex-1 rounded-full py-1.5 text-sm font-medium transition-colors",
              viewMode === opt.key ? "bg-forest-800 text-cream-50" : "text-charcoal-600",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {viewMode === "full" && (
        <FullScorecardTable
          holeCount={holeCount}
          teeSets={teeSets}
          players={players}
          playerScoreInputs={playerScoreInputs}
          editableIds={editableIds}
          skinWinnerByHole={selectedSideGame?.gameType === "skins" ? skinsView?.skinWinnerByHole : undefined}
          onCellSelect={(roundPlayerId, holeNumber) => {
            setSelectedPlayerId(roundPlayerId);
            setCurrentHole(holeNumber);
            setViewMode("hole");
          }}
        />
      )}

      {viewMode === "hole" && editablePlayers.length === 0 && (
        <p className="rounded-2xl border border-forest-900/[0.06] bg-white p-4 text-center text-base text-charcoal-500 shadow-card">
          {players.length === 0
            ? "No golfers in this round yet."
            : "You don't have permission to enter scores for this round — ask your captain."}
        </p>
      )}

      {viewMode === "hole" && editablePlayers.length > 0 && (
        <div className="rounded-2xl border border-forest-900/[0.06] bg-white p-4 shadow-card">
          <div className="text-center">
            <p className="text-sm font-medium uppercase tracking-wide text-charcoal-400">Hole</p>
            <p className="font-serif text-4xl text-forest-900">{currentHole}</p>
            <p className="text-base text-charcoal-500">
              Par {headerHoleInfo?.par ?? "—"}
              {headerHoleInfo?.stroke_index ? ` · Handicap ${headerHoleInfo.stroke_index}` : ""}
              {headerHoleInfo?.yardage ? ` · ${headerHoleInfo.yardage} yds` : ""}
            </p>
          </div>

          {/* Large, text-labeled Previous/Next Hole buttons -- the old
              nav was a pair of small icon-only circles flanking the hole
              number. These are full-width, plain-language, and a real
              tap target rather than a 48px chevron. */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={currentHole <= 1}
              onClick={() => setCurrentHole((h) => Math.max(1, h - 1))}
              className="flex h-14 items-center justify-center gap-1.5 rounded-xl bg-cream-100 text-base font-medium text-forest-800 active:bg-cream-200 disabled:opacity-30"
            >
              <span aria-hidden="true">‹</span> Previous Hole
            </button>
            <button
              type="button"
              disabled={currentHole >= holeCount}
              onClick={() => setCurrentHole((h) => Math.min(holeCount, h + 1))}
              className="flex h-14 items-center justify-center gap-1.5 rounded-xl bg-cream-100 text-base font-medium text-forest-800 active:bg-cream-200 disabled:opacity-30"
            >
              Next Hole <span aria-hidden="true">›</span>
            </button>
          </div>

          {/* Every golfer this scorekeeper can enter for, on this same
              screen -- the redesign's "one scorekeeper, whole group,
              one hole at a time" model, replacing the old single-golfer-
              at-a-time switcher. */}
          <div className="mt-5 divide-y divide-charcoal-400/10">
            {editablePlayers.map((player) => {
              const strokes = strokesTableFor(player.roundPlayerId).get(currentHole) ?? null;
              const key = scoreKey(player.roundPlayerId, currentHole);
              const gross = scores.get(key) ?? null;
              const net = netScore(gross, strokes);
              const sync = syncStatus.get(key);
              const holes = player.teeSetName ? (holesByTeeSet.get(player.teeSetName) ?? []) : (teeSets[0]?.holes ?? []);
              const par = holes.find((h) => h.hole_number === currentHole)?.par ?? null;
              return (
                <div
                  key={player.roundPlayerId}
                  className={cn(
                    "py-4 first:pt-0 last:pb-0",
                    player.roundPlayerId === selectedPlayerId && "-mx-4 rounded-lg bg-forest-50/60 px-4",
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-medium text-forest-900">{player.displayName}</p>
                      <p className="text-sm text-charcoal-400">
                        {net != null ? `Net ${net}` : "Net —"}
                        {strokes
                          ? ` (${strokes > 0 ? "+" : ""}${strokes} handicap stroke${Math.abs(strokes) === 1 ? "" : "s"})`
                          : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() => adjustScore(player, -1)}
                        className="flex h-12 w-12 items-center justify-center rounded-full bg-cream-100 text-xl font-medium text-forest-800 active:bg-cream-200 disabled:opacity-30"
                        aria-label={`Decrease ${player.displayName}'s score`}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        inputMode="numeric"
                        disabled={isLocked}
                        value={gross ?? par ?? ""}
                        onFocus={(e) => {
                          // Par is shown as soon as this row is visible; tapping
                          // the field is the deliberate action that confirms it
                          // as the actual score, same one-tap-confirm model the
                          // old single-golfer view used.
                          if (gross == null && par != null) {
                            setScore(player.roundPlayerId, currentHole, par);
                          }
                          e.target.select();
                        }}
                        onChange={(e) => {
                          const v = e.target.value === "" ? null : Number(e.target.value);
                          setScore(player.roundPlayerId, currentHole, v === null ? null : Math.min(20, Math.max(1, v)));
                        }}
                        className="h-12 w-14 rounded-xl border border-charcoal-400/25 bg-white text-center font-serif text-2xl text-forest-900 focus:border-forest-600"
                      />
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() => adjustScore(player, 1)}
                        className="flex h-12 w-12 items-center justify-center rounded-full bg-cream-100 text-xl font-medium text-forest-800 active:bg-cream-200 disabled:opacity-30"
                        aria-label={`Increase ${player.displayName}'s score`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <p className="mt-1.5 h-4 text-sm">
                    {sync === "pending" && <span className="text-amber-600">Saving…</span>}
                    {sync === "error" && <span className="text-red-600">Not synced — will retry</span>}
                    {sync === "synced" && <span className="text-emerald-600">Saved</span>}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {standings.length > 0 && (
        <div className="rounded-2xl border border-forest-900/[0.06] bg-white p-4 shadow-card">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-charcoal-400">
              {selectedSideGame ? selectedSideGame.name : "Standings"}
            </p>
            {selectedGameId === "overall" && (
              <div className="flex gap-1">
                {(["gross", "net", "stableford"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setStandingsMetric(m)}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                      standingsMetric === m ? "bg-forest-800 text-cream-50" : "bg-cream-100 text-charcoal-500",
                    )}
                  >
                    {m === "stableford" ? "Points" : m}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Game picker -- only shown once a side game exists, so a
              round with no games configured looks exactly as before. */}
          {sideGames.length > 0 && (
            <select
              value={selectedGameId}
              onChange={(e) => setSelectedGameId(e.target.value)}
              className="mt-2 h-9 w-full rounded-lg border border-charcoal-400/25 bg-white px-2.5 text-sm text-charcoal-700 focus:border-forest-600"
            >
              <option value="overall">Overall (Gross/Net/Points)</option>
              {sideGames.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          )}

          {selectedGameId === "overall" && (
            <>
              <ul className="mt-2 space-y-1.5">
                {standings.map((s) => (
                  <li key={s.roundPlayerId} className="flex items-center justify-between text-sm">
                    <span className="text-charcoal-700">
                      {s.rank}. {standingsById.get(s.roundPlayerId)?.displayName ?? "Golfer"}
                    </span>
                    <span className="font-medium text-forest-900">
                      {s.value}
                      {standingsMetric === "stableford" && <span className="text-xs text-charcoal-400"> pts</span>}{" "}
                      <span className="text-xs text-charcoal-400">thru {s.thru}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-charcoal-400">
                Net uses each golfer&apos;s playing handicap and stroke index; a golfer with no handicap on
                file shows their gross score instead.
                {sideGames.length > 0 ? " Pick a game above for its own results." : ""}
              </p>
            </>
          )}

          {selectedSideGame && selectedSideGame.gameType === "skins" && skinsView && (
            <>
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-charcoal-500">
                  {selectedSideGame.scoringMetric === "net" ? "Net" : "Gross"}
                  {selectedSideGame.carryover ? " · Carryover on" : " · No carryover"}
                </p>
                {selectedSideGame.isMonetary && selectedSideGame.dollarValue != null && (
                  <Badge variant="gold">{formatCents(dollarsToCents(selectedSideGame.dollarValue))} ante</Badge>
                )}
              </div>

              {skinsView.standings.length === 0 ? (
                <p className="mt-2 text-sm text-charcoal-400">No skins won yet.</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {skinsView.standings.map((s) => {
                    const hasDetail = s.holesWon.length > 0;
                    const isExpanded = expandedSkinsPlayerId === s.roundPlayerId;
                    return (
                      <li key={s.roundPlayerId}>
                        <button
                          type="button"
                          disabled={!hasDetail}
                          onClick={() => setExpandedSkinsPlayerId(isExpanded ? null : s.roundPlayerId)}
                          className="flex w-full items-center justify-between gap-2 text-left text-sm disabled:cursor-default"
                        >
                          <span className="text-charcoal-700">{s.displayName}</span>
                          <span className="flex items-center gap-1.5 font-medium text-forest-900">
                            {s.skinsWon} skin{s.skinsWon === 1 ? "" : "s"}
                            {s.netCents != null && (
                              <span
                                className={cn(
                                  "text-xs font-normal",
                                  s.netCents > 0 ? "text-emerald-600" : s.netCents < 0 ? "text-red-600" : "text-charcoal-400",
                                )}
                              >
                                {formatSignedCents(s.netCents)}
                              </span>
                            )}
                            {hasDetail && <span className="text-xs text-charcoal-400">{isExpanded ? "▲" : "▼"}</span>}
                          </span>
                        </button>
                        {isExpanded && hasDetail && (
                          <p className="mt-1 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-charcoal-600">
                            {s.holesWon
                              .map(
                                (h) =>
                                  `${h.label ?? "Won"} on ${h.holeNumber}${h.skinsWon > 1 ? ` (${h.skinsWon} skins)` : ""}`,
                              )
                              .join(" · ")}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              {skinsView.result.pendingPot > 1 && (
                <p className="mt-2 text-xs text-charcoal-400">
                  Next hole is worth {skinsView.result.pendingPot} skins — {skinsView.result.pendingPot - 1} carried
                  over from tied holes.
                </p>
              )}
              {skinsView.settlement && (
                <p className="mt-1 text-xs text-charcoal-400">
                  {formatCents(skinsView.settlement.potCents)} pot ({skinsView.game.participantIds.length} golfers
                  {" "}
                  &times; {formatCents(skinsView.settlement.potCents / skinsView.game.participantIds.length)} ante)
                  {skinsView.settlement.skinsAwarded > 0
                    ? ` splits across ${skinsView.settlement.skinsAwarded} skin${skinsView.settlement.skinsAwarded === 1 ? "" : "s"} so far -- a golfer with none loses exactly their ante, never more.`
                    : ", not yet split -- no skins decided."}
                </p>
              )}
              {skinsView.standings.some((s) => s.holesWon.length > 0) && (
                <p className="mt-2 text-xs text-charcoal-400">
                  Tap a golfer above to see which holes they won. The full scorecard highlights each winning
                  hole in amber.
                </p>
              )}
            </>
          )}

          {selectedSideGame && selectedSideGame.gameType !== "skins" && (
            <p className="mt-2 text-sm text-charcoal-500">
              {selectedSideGame.name} isn&apos;t shown here yet — see the{" "}
              <Link href={`/trips/${tripId}/rounds/${roundId}/games`} className="underline">
                Games
              </Link>{" "}
              and{" "}
              <Link href={`/trips/${tripId}/rounds/${roundId}/results`} className="underline">
                Results
              </Link>{" "}
              tabs for its full breakdown.
            </p>
          )}
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
