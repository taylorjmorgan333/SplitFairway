"use client";

import { useState } from "react";
import {
  SAMPLE_PARS_18,
  SAMPLE_STROKE_INDEX_18,
  clampPar,
  clampScore,
  clampStrokeIndex,
  holesForCount,
} from "@/lib/tools/sample-course";

export function useRoundDraft() {
  const [holeCount, setHoleCount] = useState<9 | 18>(18);
  const [metric, setMetric] = useState<"gross" | "net">("gross");
  const [pars, setPars] = useState<number[]>([...SAMPLE_PARS_18]);
  const [strokeIndexes, setStrokeIndexes] = useState<number[]>([...SAMPLE_STROKE_INDEX_18]);
  const [holeIndex, setHoleIndex] = useState(0);
  const [scores, setScores] = useState<Record<string, Array<number | null>>>({});

  function changeHoleCount(next: 9 | 18) {
    setHoleCount(next);
    setHoleIndex((current) => Math.min(current, next - 1));
  }

  function readScore(playerId: string, index: number): number | null {
    return scores[playerId]?.[index] ?? null;
  }

  function writeScore(playerId: string, index: number, value: number | null) {
    setScores((current) => {
      const next = Array.from({ length: holeCount }, (_, i) => current[playerId]?.[i] ?? null);
      next[index] = value;
      return { ...current, [playerId]: next };
    });
  }

  function adjustScore(playerId: string, index: number, delta: number) {
    const current = readScore(playerId, index);
    const base = current ?? pars[index] ?? 4;
    writeScore(playerId, index, clampScore(base + delta));
  }

  function setPar(index: number, value: number) {
    setPars((current) => {
      const next = [...current];
      next[index] = clampPar(value);
      return next;
    });
  }

  function setStrokeIndex(index: number, value: number) {
    setStrokeIndexes((current) => {
      const next = [...current];
      next[index] = clampStrokeIndex(value, holeCount);
      return next;
    });
  }

  function scoresFor(playerId: string): Array<number | null> {
    return Array.from({ length: holeCount }, (_, index) => scores[playerId]?.[index] ?? null);
  }

  return {
    holeCount,
    changeHoleCount,
    metric,
    setMetric,
    holeIndex,
    setHoleIndex,
    holes: holesForCount(holeCount, pars, strokeIndexes),
    readScore,
    writeScore,
    adjustScore,
    setPar,
    setStrokeIndex,
    scoresFor,
  };
}
