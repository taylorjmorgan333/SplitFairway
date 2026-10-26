"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SaveRoundCta } from "@/components/tools/save-round-cta";
import { ScoreStepper } from "@/components/tools/score-stepper";
import { SegmentedControl } from "@/components/tools/segmented-control";
import { useRoundDraft } from "@/components/tools/use-round-draft";
import { formatDollars, type CalculatorPlayer } from "@/lib/tools/calculator-score";
import { summarizeSkins } from "@/lib/tools/skins-calculator";

type DraftPlayer = { id: string; name: string; handicap: string };

const INITIAL_PLAYERS: DraftPlayer[] = [
  { id: "p1", name: "", handicap: "" },
  { id: "p2", name: "", handicap: "" },
  { id: "p3", name: "", handicap: "" },
  { id: "p4", name: "", handicap: "" },
];

let nextPlayerId = 5;

function displayName(value: string, fallback: string): string {
  return value.trim() || fallback;
}

function parseHandicap(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(54, Math.max(-10, Math.round(parsed)));
}

function parseValue(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

export function SkinsCalculator() {
  const draft = useRoundDraft();
  const [players, setPlayers] = useState<DraftPlayer[]>(INITIAL_PLAYERS);
  const [carryover, setCarryover] = useState(true);
  const [valuePerSkin, setValuePerSkin] = useState("");

  const holeNumber = draft.holeIndex + 1;
  const hole = draft.holes[draft.holeIndex];

  const summary = (() => {
    const enginePlayers: CalculatorPlayer[] = players.map((player, index) => ({
      id: player.id,
      name: displayName(player.name, `Player ${index + 1}`),
      playingHandicap: draft.metric === "net" ? parseHandicap(player.handicap) : null,
      scores: draft.scoresFor(player.id),
    }));

    return summarizeSkins({
      players: enginePlayers,
      holes: draft.holes,
      metric: draft.metric,
      carryover,
      valuePerSkin: parseValue(valuePerSkin),
    });
  })();

  function updatePlayer(id: string, patch: Partial<DraftPlayer>) {
    setPlayers((current) => current.map((player) => (player.id === id ? { ...player, ...patch } : player)));
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
        <SegmentedControl
          label="Ties"
          value={carryover ? "carry" : "void"}
          options={[
            { value: "carry", label: "Carry over" },
            { value: "void", label: "No carry" },
          ]}
          onChange={(value) => setCarryover(value === "carry")}
        />
        <div>
          <Label htmlFor="skin-value">Value per skin (optional)</Label>
          <Input
            id="skin-value"
            inputMode="decimal"
            value={valuePerSkin}
            placeholder="0"
            onChange={(event) => setValuePerSkin(event.target.value)}
          />
          <p className="mt-1.5 text-xs text-charcoal-400">
            A private tally only. SplitFairway does not hold or move money.
          </p>
        </div>
      </div>

      <fieldset className="rounded-2xl border border-forest-900/[0.08] bg-white p-4">
        <legend className="px-1 text-sm font-medium text-forest-900">Players</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {players.map((player, index) => (
            <div key={player.id} className="grid grid-cols-[1fr_auto] gap-2">
              <div>
                <Label htmlFor={`${player.id}-name`}>Player {index + 1}</Label>
                <Input
                  id={`${player.id}-name`}
                  value={player.name}
                  placeholder={`Player ${index + 1}`}
                  onChange={(event) => updatePlayer(player.id, { name: event.target.value })}
                />
              </div>
              {draft.metric === "net" && (
                <div className="w-24">
                  <Label htmlFor={`${player.id}-hcp`}>Hcp</Label>
                  <Input
                    id={`${player.id}-hcp`}
                    inputMode="numeric"
                    value={player.handicap}
                    placeholder="0"
                    onChange={(event) => updatePlayer(player.id, { handicap: event.target.value })}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-4">
          {players.length < 8 && (
            <button
              type="button"
              className="text-sm font-medium text-forest-800 underline-offset-2 hover:underline"
              onClick={() => {
                const id = `p${nextPlayerId++}`;
                setPlayers((current) => [...current, { id, name: "", handicap: "" }]);
              }}
            >
              Add player
            </button>
          )}
          {players.length > 2 && (
            <button
              type="button"
              className="text-sm font-medium text-charcoal-500 underline-offset-2 hover:underline"
              onClick={() => setPlayers((current) => current.slice(0, -1))}
            >
              Remove last
            </button>
          )}
        </div>
      </fieldset>

      <section aria-labelledby="skins-hole-heading" className="rounded-2xl bg-forest-50 p-4 sm:p-5">
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
          <h2 id="skins-hole-heading" className="font-serif text-2xl text-forest-900">
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
            <Label htmlFor="skins-par">Par</Label>
            <Input
              id="skins-par"
              inputMode="numeric"
              value={hole?.par ?? 4}
              onChange={(event) => draft.setPar(draft.holeIndex, Number(event.target.value))}
            />
          </div>
          {draft.metric === "net" && (
            <div>
              <Label htmlFor="skins-si">Stroke index</Label>
              <Input
                id="skins-si"
                inputMode="numeric"
                value={hole?.strokeIndex ?? 1}
                onChange={(event) => draft.setStrokeIndex(draft.holeIndex, Number(event.target.value))}
              />
            </div>
          )}
        </div>

        <div className="mt-4 space-y-2">
          {players.map((player, index) => {
            const name = displayName(player.name, `Player ${index + 1}`);
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
          })}
        </div>
      </section>

      <section aria-live="polite" aria-labelledby="skins-results-heading">
        <h2 id="skins-results-heading" className="text-2xl">
          Skins
        </h2>
        <p className="mt-2 text-sm text-charcoal-500">
          The lowest unique score wins the hole. A tie wins nothing
          {carryover ? ", and that skin carries to the next hole." : ", and that skin is lost."}{" "}
          A hole is scored only after every player has a number on it.
          {summary.pendingPot > 1 ? ` ${summary.pendingPot} skins are on the next open hole.` : ""}
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {summary.totals.map((total) => (
            <li key={total.id} className="rounded-2xl border border-forest-900/[0.08] bg-white px-4 py-3">
              <p className="text-sm font-medium text-forest-900">{total.name}</p>
              <p className="mt-1 text-sm text-charcoal-500">
                {total.skins} {total.skins === 1 ? "skin" : "skins"}
                {total.amount != null ? ` · ${formatDollars(total.amount)}` : ""}
              </p>
            </li>
          ))}
        </ul>
        {summary.holes.length > 0 && (
          <ol className="mt-4 space-y-1 text-sm text-charcoal-500">
            {summary.holes.map((holeResult) => (
              <li key={holeResult.holeNumber}>
                Hole {holeResult.holeNumber}:{" "}
                {holeResult.winnerName
                  ? `${holeResult.winnerName} wins ${holeResult.skinsWon}`
                  : holeResult.carriedOver
                    ? "tied, carried over"
                    : "tied, no skin"}
              </li>
            ))}
          </ol>
        )}
      </section>

      <SaveRoundCta game="skins game" />
    </div>
  );
}
