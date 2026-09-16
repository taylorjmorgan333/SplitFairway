import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Regression guard for the "Preserve historical accuracy" requirement
 * (spec section 4): a completed round's Rating/Slope/Par/Handicap
 * Index/Course Handicap/Playing Handicap must never shift because of a
 * later profile handicap edit, course-library correction, API refresh,
 * or a change to the calculation formula itself. Most of that guarantee
 * is structural -- a round's own round_course_snapshots row is written
 * once at creation and nothing here ever writes to it except the two
 * captain-gated, explicitly-scoped actions below -- so, in the same
 * spirit as guest-scoring-rls.test.ts, this reads the actual source
 * back off disk and asserts the specific lines that guarantee under
 * each of those never accidentally touch a round that already exists.
 * It is not a substitute for the live-round + profile-edit walkthrough
 * in the final verification pass, only a safety net underneath it.
 */

const SRC_DIR = join(__dirname, "../..");

function readSource(relativePath: string): string {
  return readFileSync(join(SRC_DIR, relativePath), "utf-8");
}

describe("historical accuracy: course-library writes never touch an existing round", () => {
  const courseActions = readSource("actions/courses.ts");
  const courseImportActions = readSource("actions/course-import.ts");

  for (const fnName of ["updateCourseAction", "createTeeSetAction", "updateTeeSetRatingAction", "deleteTeeSetAction", "saveHolesAction"]) {
    it(`${fnName} never writes to round_players or round_course_snapshots`, () => {
      const match = courseActions.match(new RegExp(`export async function ${fnName}[\\s\\S]*?\\n}\\n`));
      expect(match, `${fnName} should exist in actions/courses.ts`).not.toBeNull();
      expect(match![0]).not.toMatch(/from\("round_players"\)/);
      expect(match![0]).not.toMatch(/from\("round_course_snapshots"\)/);
    });
  }

  for (const fnName of ["importExternalCourseAction", "refreshExternalCourseAction"]) {
    it(`${fnName} never writes to round_players or round_course_snapshots`, () => {
      const match = courseImportActions.match(new RegExp(`export async function ${fnName}[\\s\\S]*?\\n}\\n`));
      expect(match, `${fnName} should exist in actions/course-import.ts`).not.toBeNull();
      expect(match![0]).not.toMatch(/from\("round_players"\)/);
      expect(match![0]).not.toMatch(/from\("round_course_snapshots"\)/);
    });
  }
});

describe("historical accuracy: a profile handicap edit never touches an existing round", () => {
  it("updateGolfProfileAction never writes to round_players", () => {
    const golfActions = readSource("actions/golf.ts");
    const match = golfActions.match(/export async function updateGolfProfileAction[\s\S]*?\n}\n/);
    expect(match).not.toBeNull();
    expect(match![0]).not.toMatch(/from\("round_players"\)/);
  });
});

describe("historical accuracy: Course Handicap is always computed from the round's own frozen snapshot", () => {
  it("findRoundTeeSet reads round_course_snapshots, never the live course_tee_sets table", () => {
    const roundSnapshot = readSource("lib/golf/round-snapshot.ts");
    const match = roundSnapshot.match(/export async function findRoundTeeSet[\s\S]*?\n}\n/);
    expect(match).not.toBeNull();
    expect(match![0]).toMatch(/from\("round_course_snapshots"\)/);
    expect(match![0]).not.toMatch(/from\("course_tee_sets"\)/);
  });
});

describe("historical accuracy: the in-progress tee-data refresh action refuses a finished round", () => {
  it("refreshRoundTeeDataAction rejects completed/locked rounds before touching anything", () => {
    const roundsActions = readSource("actions/rounds.ts");
    const match = roundsActions.match(/export async function refreshRoundTeeDataAction[\s\S]*?\n}\n/);
    expect(match).not.toBeNull();
    expect(match![0]).toMatch(/status !== "scheduled" && round\.status !== "in_progress"/);
  });

  it("refreshRoundTeeDataAction never recalculates a player who already has a Course Handicap or a manual override", () => {
    const roundsActions = readSource("actions/rounds.ts");
    const match = roundsActions.match(/export async function refreshRoundTeeDataAction[\s\S]*?\n}\n/);
    expect(match).not.toBeNull();
    expect(match![0]).toMatch(/if \(player\.course_handicap != null\) continue;/);
    expect(match![0]).toMatch(/if \(player\.playing_handicap_source === "manual"\) continue;/);
  });
});

describe("historical accuracy: a manual Playing Handicap override survives a tee change", () => {
  it("updateRoundPlayerAction only recalculates when the caller explicitly asks for 'calculated'", () => {
    const roundsActions = readSource("actions/rounds.ts");
    const match = roundsActions.match(/export async function updateRoundPlayerAction[\s\S]*?\n}\n/);
    expect(match).not.toBeNull();
    expect(match![0]).toMatch(/const wantsManual = handicapSource === "manual";/);
    expect(match![0]).toMatch(/const resolvedPlayingHandicap = wantsManual \? manualValue : courseHandicap;/);
  });
});
