"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { saveHolesAction } from "@/actions/courses";
import type { ActionState } from "@/actions/auth";
import type { Tables } from "@/lib/supabase/database.types";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

const initialState: ActionState = { status: "idle" };

type Row = { holeNumber: number; par: string; yardage: string; strokeIndex: string };

function buildInitialRows(holeCount: number, existing: Tables<"course_holes">[]): Row[] {
  const byHole = new Map(existing.map((h) => [h.hole_number, h]));
  return Array.from({ length: holeCount }, (_, i) => {
    const holeNumber = i + 1;
    const hole = byHole.get(holeNumber);
    return {
      holeNumber,
      par: hole ? String(hole.par) : "4",
      yardage: hole?.yardage != null ? String(hole.yardage) : "",
      strokeIndex: hole?.stroke_index != null ? String(hole.stroke_index) : "",
    };
  });
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving scorecard…" : "Save scorecard"}
    </Button>
  );
}

/**
 * Per-tee-set hole-by-hole entry grid: par (required), yardage and
 * stroke index (optional) for every hole. Submits the whole grid as one
 * JSON payload (src/actions/courses.ts#saveHolesAction) rather than one
 * field per cell, so a 9- or 18-row grid is still a single form field.
 * Large tap targets and numeric keyboards (inputMode) — this is exactly
 * the kind of screen someone might fill in on a phone standing at the
 * pro shop counter.
 */
export function HolesGridForm({
  courseId,
  teeSetId,
  holeCount,
  existingHoles,
}: {
  courseId: string;
  teeSetId: string;
  holeCount: number;
  existingHoles: Tables<"course_holes">[];
}) {
  const [rows, setRows] = useState<Row[]>(() => buildInitialRows(holeCount, existingHoles));
  const action = saveHolesAction.bind(null, courseId, teeSetId);
  const [state, formAction] = useActionState(action, initialState);

  function updateRow(index: number, field: keyof Omit<Row, "holeNumber">, value: string) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }

  const holesJson = JSON.stringify(
    rows.map((r) => ({
      holeNumber: r.holeNumber,
      par: r.par,
      yardage: r.yardage,
      strokeIndex: r.strokeIndex,
    })),
  );

  const front = rows.slice(0, 9);
  const back = rows.slice(9);

  return (
    <form action={formAction} className="space-y-4">
      {state.status === "error" && state.message && (
        <Alert variant="error">{state.message}</Alert>
      )}
      {state.status === "success" && state.message && (
        <Alert variant="success">{state.message}</Alert>
      )}

      {[front, back].map(
        (half, halfIndex) =>
          half.length > 0 && (
            <div key={halfIndex} className="overflow-x-auto">
              <table className="w-full min-w-[480px] border-collapse text-sm">
                <thead>
                  <tr className="text-left text-xs text-charcoal-400">
                    <th className="w-14 py-1.5 pr-2 font-medium">Hole</th>
                    <th className="py-1.5 pr-2 font-medium">Par</th>
                    <th className="py-1.5 pr-2 font-medium">Yardage</th>
                    <th className="py-1.5 font-medium">Stroke index</th>
                  </tr>
                </thead>
                <tbody>
                  {half.map((row) => {
                    const index = row.holeNumber - 1;
                    return (
                      <tr key={row.holeNumber} className="border-t border-charcoal-400/10">
                        <td className="py-1.5 pr-2 font-medium text-charcoal-700">
                          {row.holeNumber}
                        </td>
                        <td className="py-1.5 pr-2">
                          <input
                            type="number"
                            inputMode="numeric"
                            min={3}
                            max={6}
                            value={row.par}
                            onChange={(e) => updateRow(index, "par", e.target.value)}
                            className={cn(
                              "h-11 w-16 rounded-lg border border-charcoal-400/25 bg-white px-2 text-center text-sm",
                              "focus:border-forest-600",
                            )}
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <input
                            type="number"
                            inputMode="numeric"
                            placeholder="—"
                            value={row.yardage}
                            onChange={(e) => updateRow(index, "yardage", e.target.value)}
                            className="h-11 w-20 rounded-lg border border-charcoal-400/25 bg-white px-2 text-center text-sm focus:border-forest-600"
                          />
                        </td>
                        <td className="py-1.5">
                          <input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={18}
                            placeholder="—"
                            value={row.strokeIndex}
                            onChange={(e) => updateRow(index, "strokeIndex", e.target.value)}
                            className="h-11 w-16 rounded-lg border border-charcoal-400/25 bg-white px-2 text-center text-sm focus:border-forest-600"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ),
      )}

      <input type="hidden" name="holes" value={holesJson} readOnly />
      <SaveButton />
    </form>
  );
}
