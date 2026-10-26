"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SaveRoundCta } from "@/components/tools/save-round-cta";
import { ScoreStepper } from "@/components/tools/score-stepper";
import { SegmentedControl } from "@/components/tools/segmented-control";
import { useRoundDraft } from "@/components/tools/use-round-draft";
import { formatDollars, type CalculatorPlayer } from "@/lib/tools/calculator-score";
import { summarizeNassau } from "@/lib/tools/nassau-calculator";

type DraftPlayer = { id: string; name: string; handicap: string };
type DraftSide = { name: string; players: DraftPlayer[] };

const INITIAL_SIDES: [DraftSide, DraftSide] = [
  { name: "", players: [{ id: "a1", name: "", handicap: "" }] },
  { name: "", players: [{ id: "b1", name: "", handicap: "" }] },
];

function displayName(value: string, fallback: string): string {
  return value.trim() || fallback;
}

function parseHandicap(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(54, Math.max(-10, Math.round(parsed)));
}

function parseStake(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

export function NassauCalculator() {
  const draft = useRoundDraft();
  const [sides, setSides] = useState<[DraftSide, DraftSide]>(INITIAL_SIDES);
  const [stake, setStake] = useState("");
  const [pressHole, setPressHole] = useState("10");
  const [presses, setPresses] = useState<number[]>([]);

  const holeNumber = draft.holeIndex + 1;
  const hole = draft.holes[draft.holeIndex];

  const matches = (() => {
    const engineSides = sides.map((side, sideIndex) => ({
      name: displayName(side.name, sideIndex === 0 ? "Side A" : "Side B"),
      players: side.players.map((player, playerIndex) => {
        const enginePlayer: CalculatorPlayer = {
          id: player.id,
          name: displayName(player.name, `Player ${playerIndex + 1}`),
          playingHandicap: draft.metric === "net" ? parseHandicap(player.handicap) : null,
          scores: draft.scoresFor(player.id),
        };
        return enginePlayer;
      }),
    })) as [
      { name: string; players: CalculatorPlayer[] },
      { name: string; players: CalculatorPlayer[] },
    ];

    return summarizeNassau({
      sides: engineSides,
      holes: draft.holes,
      metric: draft.metric,
      stakePerMatch: parseStake(stake),
      pressesFromHole: presses,
    });
  })();

  function updateSide(index: 0 | 1, patch: Partial<DraftSide>) {
    setSides((current) => {
      const next: [DraftSide, DraftSide] = [...current] as [DraftSide, DraftSide];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  function updatePlayer(sideIndex: 0 | 1, playerId: string, patch: Partial<DraftPlayer>) {
    updateSide(sideIndex, {
      players: sides[sideIndex].players.map((player) =>
        player.id === playerId ? { ...player, ...patch } : player,
      ),
    });
  }

  function addPartner(sideIndex: 0 | 1) {
    const side = sides[sideIndex];
    if (side.players.length >= 2) return;
    const id = `${sideIndex === 0 ? "a" : "b"}2`;
    updateSide(sideIndex, { players: [...side.players, { id, name: "", handicap: "" }] });
  }

  function addPress() {
    const hole = Math.round(Number(pressHole));
    if (!Number.isFinite(hole)) return;
    setPresses((current) => (current.includes(hole) ? current : [...current, hole]));
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <SegmentedControl
          label="Holes"
          value={String(draft.holeCount) as "9" | "18"}
          options={[
            { value: "18", label: "18 holes" },
            { value: "9", label: "9 holes" },
          ]}
          onChange={(value) => draft.changeHoleCount(value === "9" ? 9 : 18)}
        />
        <SegmentedControl
          label="Scoring"
          value={draft.metric}
          options={[
            { value: "gross", label: "Gross" },
            { value: "net", label: "Net" },
          ]}
          onChange={draft.setMetric}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {sides.map((side, sideIndex) => {
          const index = sideIndex as 0 | 1;
          return (
            <fieldset key={index} className="rounded-2xl border border-forest-900/[0.08] bg-white p-4">
              <legend className="px-1 text-sm font-medium text-forest-900">
                {index === 0 ? "Side A" : "Side B"}
              </legend>
              <Label htmlFor={`side-name-${index}`}>Side name</Label>
              <Input
                id={`side-name-${index}`}
                value={side.name}
                placeholder={index === 0 ? "Side A" : "Side B"}
                onChange={(event) => updateSide(index, { name: event.target.value })}
              />
              {side.players.map((player, playerIndex) => (
                <div key={player.id} className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor={`${player.id}-name`}>Player {playerIndex + 1}</Label>
                    <Input
                      id={`${player.id}-name`}
                      value={player.name}
                      placeholder={`Player ${playerIndex + 1}`}
                      onChange={(event) => updatePlayer(index, player.id, { name: event.target.value })}
                    />
                  </div>
                  {draft.metric === "net" && (
                    <div>
                      <Label htmlFor={`${player.id}-hcp`}>Playing handicap</Label>
                      <Input
                        id={`${player.id}-hcp`}
                        inputMode="numeric"
                        value={player.handicap}
                        placeholder="0"
                        onChange={(event) => updatePlayer(index, player.id, { handicap: event.target.value })}
                      />
                    </div>
                  )}
                </div>
              ))}
              {side.players.length < 2 && (
                <button
                  type="button"
                  className="mt-3 text-sm font-medium text-forest-800 underline-offset-2 hover:underline"
                  onClick={() => addPartner(index)}
                >
                  Add partner (best ball)
                </button>
              )}
            </fieldset>
          );
        })}
      </div>

      <div className="max-w-xs">
        <Label htmlFor="nassau-stake">Bet per match (optional)</Label>
        <Input
          id="nassau-stake"
          inputMode="decimal"
          value={stake}
          placeholder="0"
          onChange={(event) => setStake(event.target.value)}
        />
        <p className="mt-1.5 text-xs text-charcoal-400">
          A Nassau pays this once for the front, once for the back, and once for the overall — not
          per hole. This is a private tally. SplitFairway does not hold or move money.
        </p>
      </div>

      <section aria-labelledby="nassau-hole-heading" className="rounded-2xl bg-forest-50 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            className="h-11 rounded-full border border-forest-900/15 px-4 text-sm font-medium text-forest-900 disabled:opacity-40"
            aria-label="Previous hole"
            disabled={draft.holeIndex === 0}
            onClick={() => draft.setHoleIndex(draft.holeIndex - 1)}
          >
            Previous
          </button>
          <h2 id="nassau-hole-heading" className="font-serif text-2xl text-forest-900">
            Hole {holeNumber}
          </h2>
          <button
            type="button"
            className="h-11 rounded-full border border-forest-900/15 px-4 text-sm font-medium text-forest-900 disabled:opacity-40"
            aria-label="Next hole"
            disabled={draft.holeIndex >= draft.holeCount - 1}
            onClick={() => draft.setHoleIndex(draft.holeIndex + 1)}
          >
            Next
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="nassau-par">Par</Label>
            <Input
              id="nassau-par"
              inputMode="numeric"
              value={hole?.par ?? 4}
              onChange={(event) => draft.setPar(draft.holeIndex, Number(event.target.value))}
            />
          </div>
          {draft.metric === "net" && (
            <div>
              <Label htmlFor="nassau-si">Stroke index</Label>
              <Input
                id="nassau-si"
                inputMode="numeric"
                value={hole?.strokeIndex ?? 1}
                onChange={(event) => draft.setStrokeIndex(draft.holeIndex, Number(event.target.value))}
              />
            </div>
          )}
        </div>
        {draft.metric === "net" && (
          <p className="mt-2 text-xs text-charcoal-500">
            Stroke indexes start as a sample card, not a real course. Change them to match the
            scorecard. The harder holes (lower index) get handicap strokes first.
          </p>
        )}

        <div className="mt-4 space-y-2">
          {sides.flatMap((side, sideIndex) =>
            side.players.map((player, playerIndex) => {
              const name = displayName(
                player.name,
                `${sideIndex === 0 ? "Side A" : "Side B"} player ${playerIndex + 1}`,
              );
              return (
                <ScoreStepper
                  key={player.id}
                  name={name}
                  holeNumber={holeNumber}
                  score={draft.readScore(player.id, draft.holeIndex)}
                  onDecrease={() => draft.adjustScore(player.id, draft.holeIndex, -1)}
                  onIncrease={() => draft.adjustScore(player.id, draft.holeIndex, 1)}
                  onClear={() => draft.writeScore(player.id, draft.holeIndex, null)}
                />
              );
            }),
          )}
        </div>
      </section>

      {draft.holeCount > 9 && (
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="press-hole">Press from hole</Label>
            <Input
              id="press-hole"
              className="w-28"
              inputMode="numeric"
              value={pressHole}
              onChange={(event) => setPressHole(event.target.value)}
            />
          </div>
          <button
            type="button"
            className="h-11 rounded-full border border-forest-900/15 px-4 text-sm font-medium text-forest-900"
            onClick={addPress}
          >
            Add press
          </button>
          {presses.length > 0 && (
            <button
              type="button"
              className="h-11 text-sm text-charcoal-500 underline-offset-2 hover:underline"
              onClick={() => setPresses([])}
            >
              Clear presses
            </button>
          )}
        </div>
      )}

      <section aria-live="polite" aria-labelledby="nassau-results-heading">
        <h2 id="nassau-results-heading" className="text-2xl">
          Matches
        </h2>
        <p className="mt-2 text-sm text-charcoal-500">
          Low score wins the hole, ties are halved, and a side with two players plays best ball.
          The match closes when one side is up by more holes than are left.
        </p>
        <ul className="mt-4 space-y-3">
          {matches.map((match) => (
            <li
              key={match.id}
              className="rounded-2xl border border-forest-900/[0.08] bg-white px-4 py-3"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-charcoal-400">{match.label}</p>
              <p className="mt-1 text-base font-medium text-forest-900">{match.result}</p>
              {match.payout && (
                <p className="mt-1 text-sm text-charcoal-500">
                  {match.payout.winnerName} takes {formatDollars(match.payout.amount)}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <SaveRoundCta game="Nassau" />
    </div>
  );
}
