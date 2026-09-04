"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  computePlayerTotals,
  computeStandings,
  type PlayerScoreInput,
  type StandingsMetric,
} from "@/lib/golf/scoring";
import { cn } from "@/lib/utils";
import type { ScorecardPlayer, SnapshotTeeSet } from "@/components/rounds/mobile-scorecard";

type LeaderboardView = "gross" | "net" | "games";

type ConnectionState = "connecting" | "live" | "offline";

/**
 * Live, auto-updating standings for a round (phase 8). Subscribes to
 * Supabase Realtime's postgres_changes on hole_scores, filtered to this
 * round, and re-reads the round's scores through the normal RLS-scoped
 * client whenever a change comes in -- Realtime enforces the same
 * hole_scores_select_visible policy as any other read (see
 * supabase/migrations/20260903070000_leaderboard_realtime.sql), so a
 * viewer only ever sees updates for scores they're already allowed to
 * see. Falls back gracefully to the initial, server-rendered snapshot
 * if the realtime channel never connects (e.g. no realtime access) --
 * the page is still useful as a manual-refresh leaderboard either way.
 */
export function LiveLeaderboard({
  roundId,
  holeCount,
  teeSets,
  players,
  initialScores,
  liveScoreVisibility,
  isCaptain,
  games,
  sideGamesEnabled,
  gamesHref,
}: {
  roundId: string;
  holeCount: number;
  teeSets: SnapshotTeeSet[];
  players: ScorecardPlayer[];
  initialScores: { roundPlayerId: string; holeNumber: number; grossStrokes: number | null }[];
  liveScoreVisibility: boolean;
  isCaptain: boolean;
  games: { id: string; name: string; gameType: string }[];
  sideGamesEnabled: boolean;
  gamesHref: string;
}) {
  const [scores, setScores] = useState(initialScores);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  // "Net" is the simplest relevant default -- it's each golfer's own
  // score against their own handicap, the number most golfers actually
  // care about round to round. Gross and Games are one tap away.
  const [view, setView] = useState<LeaderboardView>("net");
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const holesByTeeSet = useMemo(() => {
    const byName = new Map<string, SnapshotTeeSet["holes"]>();
    for (const ts of teeSets) byName.set(ts.name, ts.holes);
    return byName;
  }, [teeSets]);

  useEffect(() => {
    const supabase = createClient();

    function scheduleRefetch() {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      // Small debounce so several scores saved in quick succession (a
      // captain entering a whole group's hole at once) trigger one
      // refetch instead of one per row.
      refetchTimer.current = setTimeout(async () => {
        const { data, error } = await supabase
          .from("hole_scores")
          .select("round_player_id, hole_number, gross_strokes")
          .eq("round_id", roundId);
        if (!error && data) {
          setScores(
            data.map((s) => ({
              roundPlayerId: s.round_player_id,
              holeNumber: s.hole_number,
              grossStrokes: s.gross_strokes,
            })),
          );
          setLastUpdated(new Date());
        }
      }, 400);
    }

    const channel = supabase
      .channel(`leaderboard-${roundId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hole_scores", filter: `round_id=eq.${roundId}` },
        () => scheduleRefetch(),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setConnection("live");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setConnection("offline");
        }
      });

    return () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      supabase.removeChannel(channel);
    };
  }, [roundId]);

  const playerScoreInputs: PlayerScoreInput[] = useMemo(() => {
    const grossByPlayer = new Map<string, Map<number, number | null>>();
    for (const p of players) {
      const m = new Map<number, number | null>();
      for (let h = 1; h <= holeCount; h++) m.set(h, null);
      grossByPlayer.set(p.roundPlayerId, m);
    }
    for (const s of scores) {
      grossByPlayer.get(s.roundPlayerId)?.set(s.holeNumber, s.grossStrokes);
    }
    return players.map((p) => {
      const holes = p.teeSetName ? (holesByTeeSet.get(p.teeSetName) ?? []) : (teeSets[0]?.holes ?? []);
      return {
        roundPlayerId: p.roundPlayerId,
        playingHandicap: p.playingHandicap,
        holes: holes.map((h) => ({ holeNumber: h.hole_number, par: h.par, strokeIndex: h.stroke_index })),
        grossByHole: grossByPlayer.get(p.roundPlayerId) ?? new Map(),
      };
    });
  }, [players, scores, holeCount, holesByTeeSet, teeSets]);

  const standingsMetric: StandingsMetric = view === "gross" ? "gross" : "net";
  const standings = computeStandings(playerScoreInputs, standingsMetric);
  const playersById = new Map(players.map((p) => [p.roundPlayerId, p]));
  const totalsById = new Map(playerScoreInputs.map((p) => [p.roundPlayerId, computePlayerTotals(p)]));

  const GAME_TYPE_LABEL: Record<string, string> = {
    nassau: "Nassau", skins: "Skins", wolf: "Wolf", vegas: "Vegas", quota: "Quota", nines: "Nines",
    twos: "Twos Club", match_play: "Match Play", stroke_play: "Stroke Play", stableford: "Stableford",
    best_ball: "Best Ball", worst_ball: "Worst Ball", shamble: "Shamble", team_average: "Team Average",
    lone_ranger: "Lone Ranger", cha_cha_cha: "Cha Cha Cha", one_gross_one_net: "One Gross One Net",
    low_ball_high_ball: "Low Ball High Ball", low_ball_low_total: "Low Ball Low Total",
    low_handicap_high_handicap: "Low Handicap High Handicap", custom: "Custom Game",
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              connection === "live" ? "bg-emerald-500" : connection === "connecting" ? "bg-amber-500" : "bg-charcoal-400/40",
            )}
          />
          <span className="text-xs text-charcoal-400">
            {connection === "live" ? "Live" : connection === "connecting" ? "Connecting…" : "Not connected — showing last known scores"}
            {lastUpdated && ` · updated ${lastUpdated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}
          </span>
        </div>
        <div className="flex gap-1">
          {(["gross", "net", "games"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                "rounded-full px-2.5 py-1 text-sm font-medium capitalize transition-colors",
                view === v ? "bg-forest-800 text-cream-50" : "bg-cream-100 text-charcoal-500",
              )}
            >
              {v === "games" ? "Games" : v}
            </button>
          ))}
        </div>
      </div>

      {!liveScoreVisibility && !isCaptain && (
        <p className="rounded-lg bg-cream-100 px-3.5 py-2.5 text-sm text-charcoal-500">
          This round&apos;s scores are private — you&apos;re only seeing your own and your group&apos;s.
        </p>
      )}

      {view === "games" ? (
        <div className="overflow-hidden rounded-2xl border border-forest-900/[0.06] bg-white shadow-card">
          {!sideGamesEnabled ? (
            <p className="px-4 py-6 text-center text-base text-charcoal-400">Games aren&apos;t turned on for this trip.</p>
          ) : games.length === 0 ? (
            <p className="px-4 py-6 text-center text-base text-charcoal-400">
              No games set up yet — add one from the Games tab.
            </p>
          ) : (
            <ul className="divide-y divide-charcoal-400/10">
              {games.map((g) => (
                <li key={g.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-base font-medium text-charcoal-800">{g.name}</p>
                    <p className="text-sm text-charcoal-400">{GAME_TYPE_LABEL[g.gameType] ?? g.gameType}</p>
                  </div>
                  <Link href={gamesHref} className="text-sm font-medium text-forest-700 underline-offset-2 hover:underline">
                    See details
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-forest-900/[0.06] bg-white shadow-card">
          {standings.length === 0 ? (
            <p className="px-4 py-6 text-center text-base text-charcoal-400">
              No scores entered yet — the leaderboard fills in as golfers enter theirs.
            </p>
          ) : (
            <ul className="divide-y divide-charcoal-400/10">
              {standings.map((s) => {
                const player = playersById.get(s.roundPlayerId);
                const totals = totalsById.get(s.roundPlayerId);
                return (
                  <li key={s.roundPlayerId} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="w-6 text-base font-medium text-charcoal-400">{s.rank}</span>
                      <div>
                        <p className="text-base font-medium text-charcoal-800">{player?.displayName ?? "Golfer"}</p>
                        <p className="text-sm text-charcoal-400">
                          thru {s.thru}
                          {totals?.front.gross != null && totals?.back.gross != null
                            ? ` · ${totals.front.gross} / ${totals.back.gross}`
                            : ""}
                        </p>
                      </div>
                    </div>
                    <span className="font-serif text-lg text-forest-900">{s.value}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <p className="text-sm text-charcoal-400">
        Net uses each golfer&apos;s playing handicap and stroke index; a golfer with no handicap on file
        shows their gross score instead. Points and full game standings are on the Games tab.
      </p>
    </div>
  );
}
