"use client";

import { useMemo, useState } from "react";
import { netScore } from "@/lib/golf/handicap";
import { computePlayerTotals, strokesReceivedByHole, type PlayerScoreInput } from "@/lib/golf/scoring";
import { cn } from "@/lib/utils";
import type { ScorecardPlayer, SnapshotTeeSet } from "@/components/rounds/mobile-scorecard";

type Metric = "gross" | "net";

/**
 * The traditional, all-holes-at-once scorecard: one row per golfer, one
 * column per hole, par/yardage/stroke-index header rows -- the view a
 * printed scorecard gives you, next to (not instead of) the one-hole
 * entry card above, which is what's actually fast to enter scores with
 * on a phone mid-round. Purely a display: it reads the same
 * PlayerScoreInput[] the parent already built for standings, so there's
 * no separate fetch or state, but a cell can still hand editing back to
 * the entry card via onCellSelect for anyone who taps a hole they want
 * to fix.
 */
export function FullScorecardTable({
  holeCount,
  teeSets,
  players,
  playerScoreInputs,
  editableIds,
  skinWinnerByHole,
  onCellSelect,
}: {
  holeCount: number;
  teeSets: SnapshotTeeSet[];
  players: ScorecardPlayer[];
  playerScoreInputs: PlayerScoreInput[];
  editableIds: Set<string>;
  /** Hole number -> the round_player_id who won that hole's skin, for
   * whichever skins game the Standings card has selected -- undefined
   * (not just empty) when no skins game is currently selected, so a
   * round with no side games looks exactly as before. */
  skinWinnerByHole?: Map<number, string>;
  onCellSelect?: (roundPlayerId: string, holeNumber: number) => void;
}) {
  const [metric, setMetric] = useState<Metric>("gross");

  const holeNumbers = useMemo(() => Array.from({ length: holeCount }, (_, i) => i + 1), [holeCount]);
  const hasBack = holeCount > 9;
  const frontHoles = holeNumbers.filter((h) => h <= 9);
  const backHoles = holeNumbers.filter((h) => h > 9);

  // Par and stroke index don't vary by tee in the overwhelming majority
  // of real courses (only yardage does), so one reference tee's holes
  // drive those two header rows; every tee actually in play among these
  // golfers gets its own yardage row, which is the part that does vary.
  const usedTeeSetNames = useMemo(() => {
    const names = new Set<string>();
    for (const p of players) {
      if (p.teeSetName) names.add(p.teeSetName);
    }
    if (names.size === 0 && teeSets[0]) names.add(teeSets[0].name);
    return Array.from(names);
  }, [players, teeSets]);

  const referenceHoles =
    (usedTeeSetNames[0] && teeSets.find((t) => t.name === usedTeeSetNames[0])?.holes) || teeSets[0]?.holes || [];
  const parByHole = new Map(referenceHoles.map((h) => [h.hole_number, h.par]));
  const siByHole = new Map(referenceHoles.map((h) => [h.hole_number, h.stroke_index]));
  const outPar = frontHoles.reduce((sum, h) => sum + (parByHole.get(h) ?? 0), 0);
  const inPar = backHoles.reduce((sum, h) => sum + (parByHole.get(h) ?? 0), 0);

  const inputById = new Map(playerScoreInputs.map((p) => [p.roundPlayerId, p]));

  function rangeCell(holes: number[], totals: ReturnType<typeof computePlayerTotals> | null, kind: "front" | "back") {
    if (!totals) return "—";
    const range = kind === "front" ? totals.front : totals.back;
    if (range.holesCompleted === 0) return "—";
    const value = metric === "net" ? (range.net ?? range.gross) : range.gross;
    return value ?? "—";
  }

  return (
    <div className="rounded-2xl border border-forest-900/[0.06] bg-white p-4 shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-charcoal-400">Full scorecard</p>
        <div className="flex gap-1">
          {(["gross", "net"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                metric === m ? "bg-forest-800 text-cream-50" : "bg-cream-100 text-charcoal-500",
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 -mx-4 overflow-x-auto px-4">
        <table className="w-full min-w-max border-separate border-spacing-0 text-center text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white pb-1 pr-3 text-left align-bottom text-xs font-medium uppercase tracking-wide text-charcoal-400">
                Hole
              </th>
              {frontHoles.map((h) => (
                <th key={h} className="min-w-[2.25rem] pb-1 align-bottom font-medium text-charcoal-500">
                  {h}
                </th>
              ))}
              <th className="min-w-[2.75rem] pb-1 align-bottom font-medium text-charcoal-700">Out</th>
              {hasBack &&
                backHoles.map((h) => (
                  <th key={h} className="min-w-[2.25rem] pb-1 align-bottom font-medium text-charcoal-500">
                    {h}
                  </th>
                ))}
              {hasBack && <th className="min-w-[2.75rem] pb-1 align-bottom font-medium text-charcoal-700">In</th>}
              <th className="min-w-[3rem] pb-1 align-bottom font-medium text-forest-900">Tot</th>
            </tr>
            <tr className="text-xs text-charcoal-400">
              <th className="sticky left-0 z-10 bg-white py-1 pr-3 text-left font-normal">Par</th>
              {frontHoles.map((h) => (
                <td key={h} className="py-1">
                  {parByHole.get(h) ?? "—"}
                </td>
              ))}
              <td className="py-1 font-medium text-charcoal-600">{outPar || "—"}</td>
              {hasBack &&
                backHoles.map((h) => (
                  <td key={h} className="py-1">
                    {parByHole.get(h) ?? "—"}
                  </td>
                ))}
              {hasBack && <td className="py-1 font-medium text-charcoal-600">{inPar || "—"}</td>}
              <td className="py-1 font-medium text-charcoal-600">{outPar + inPar || "—"}</td>
            </tr>
            <tr className="text-xs text-charcoal-400">
              <th className="sticky left-0 z-10 bg-white py-1 pr-3 text-left font-normal">SI</th>
              {frontHoles.map((h) => (
                <td key={h} className="py-1">
                  {siByHole.get(h) ?? "—"}
                </td>
              ))}
              <td className="py-1" />
              {hasBack &&
                backHoles.map((h) => (
                  <td key={h} className="py-1">
                    {siByHole.get(h) ?? "—"}
                  </td>
                ))}
              {hasBack && <td className="py-1" />}
              <td className="py-1" />
            </tr>
            {usedTeeSetNames.map((name) => {
              const holes = teeSets.find((t) => t.name === name)?.holes ?? [];
              const yardageByHole = new Map(holes.map((h) => [h.hole_number, h.yardage]));
              const outYards = frontHoles.reduce((sum, h) => sum + (yardageByHole.get(h) ?? 0), 0);
              const inYards = backHoles.reduce((sum, h) => sum + (yardageByHole.get(h) ?? 0), 0);
              return (
                <tr key={name} className="text-xs text-charcoal-400">
                  <th className="sticky left-0 z-10 bg-white py-1 pr-3 text-left font-normal">{name}</th>
                  {frontHoles.map((h) => (
                    <td key={h} className="py-1">
                      {yardageByHole.get(h) ?? "—"}
                    </td>
                  ))}
                  <td className="py-1">{outYards || "—"}</td>
                  {hasBack &&
                    backHoles.map((h) => (
                      <td key={h} className="py-1">
                        {yardageByHole.get(h) ?? "—"}
                      </td>
                    ))}
                  {hasBack && <td className="py-1">{inYards || "—"}</td>}
                  <td className="py-1">{outYards + inYards || "—"}</td>
                </tr>
              );
            })}
          </thead>
          <tbody>
            {players.map((p) => {
              const input = inputById.get(p.roundPlayerId) ?? null;
              const totals = input ? computePlayerTotals(input) : null;
              const strokes = input ? strokesReceivedByHole(input.playingHandicap, input.holes) : new Map();
              const canEdit = editableIds.has(p.roundPlayerId);

              function cellFor(h: number) {
                const gross = input?.grossByHole.get(h) ?? null;
                const par = parByHole.get(h) ?? null;
                const display = metric === "net" ? (netScore(gross, strokes.get(h) ?? null) ?? gross) : gross;
                const diff = gross != null && par != null ? gross - par : null;
                const wonSkin = skinWinnerByHole?.get(h) === p.roundPlayerId;

                return (
                  <td key={h} className="py-1">
                    <button
                      type="button"
                      disabled={!onCellSelect}
                      onClick={() => onCellSelect?.(p.roundPlayerId, h)}
                      title={wonSkin ? `Won the skin on hole ${h}` : undefined}
                      className={cn(
                        "mx-auto flex h-7 w-7 items-center justify-center text-sm text-charcoal-800",
                        canEdit && onCellSelect && "cursor-pointer hover:bg-cream-100",
                        !canEdit && "text-charcoal-500",
                        diff != null && diff <= -2 && "rounded-full text-gold-700 ring-2 ring-gold-500",
                        diff === -1 && "rounded-full text-forest-800 ring-2 ring-forest-600",
                        diff === 1 && "rounded-sm border border-charcoal-400",
                        diff != null && diff >= 2 && "rounded-sm border-2 border-charcoal-500",
                        wonSkin && "rounded-md bg-amber-200",
                      )}
                    >
                      {display ?? "–"}
                    </button>
                  </td>
                );
              }

              return (
                <tr key={p.roundPlayerId} className="border-t border-forest-900/[0.06]">
                  <th className="sticky left-0 z-10 bg-white py-1.5 pr-3 text-left font-medium text-charcoal-800">
                    {p.displayName}
                  </th>
                  {frontHoles.map(cellFor)}
                  <td className="py-1.5 font-medium text-charcoal-700">{rangeCell(frontHoles, totals, "front")}</td>
                  {hasBack && backHoles.map(cellFor)}
                  {hasBack && (
                    <td className="py-1.5 font-medium text-charcoal-700">{rangeCell(backHoles, totals, "back")}</td>
                  )}
                  <td className="py-1.5 font-semibold text-forest-900">
                    {totals && totals.total.holesCompleted > 0
                      ? (metric === "net" ? (totals.total.net ?? totals.total.gross) : totals.total.gross)
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-charcoal-400">
        Circled scores are under par, boxed scores are over par — a double ring or box means two or more.
        {onCellSelect && " Tap a score to jump to it above."}
        {skinWinnerByHole && " Amber highlights mark the hole and golfer who won that skin."}
      </p>
    </div>
  );
}
