import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Root cause of the "Couldn't discard this round" production failure
 * (2026-09-15): this migration's discard_round()/restore_round() SQL
 * was correct and committed, but was never actually applied to the
 * live Supabase project -- PostgREST's schema cache had no record of
 * the function (PGRST202: "Could not find the function
 * public.discard_round(p_round_id) in the schema cache"), confirmed
 * via Vercel runtime error logs. The fix is operational (apply the
 * migration), not a code change to this file. This test guards against
 * the same class of failure recurring silently by asserting the
 * migration's security-critical lines stay intact -- same convention
 * as guest-scoring-rls.test.ts, since this project's vitest run has no
 * live-database harness to exercise RLS/RPC behavior directly (see
 * vitest.config.ts: environment "node").
 *
 * Not a substitute for the manual creator/captain/non-captain test
 * pass against the real database -- only a safety net underneath it.
 */

const MIGRATIONS_DIR = join(__dirname, "../../../supabase/migrations");

function readMigration(filename: string): string {
  return readFileSync(join(MIGRATIONS_DIR, filename), "utf-8");
}

describe("round soft-delete migration (discard_round / restore_round)", () => {
  const sql = readMigration("20260918100000_round_soft_delete.sql");

  it("adds deleted_at/deleted_by as nullable columns -- purely additive, no existing row affected", () => {
    expect(sql).toMatch(/add column deleted_at timestamptz/);
    expect(sql).toMatch(/add column deleted_by uuid references public\.profiles\(id\) on delete set null/);
  });

  it("excludes discarded rounds from both rounds SELECT policies", () => {
    for (const policy of ["rounds_select_members", "rounds_select_group_members"]) {
      const policyMatch = sql.match(new RegExp(`create policy "${policy}"[\\s\\S]*?;`));
      expect(policyMatch, `${policy} should exist`).not.toBeNull();
      expect(policyMatch![0]).toMatch(/deleted_at is null/);
    }
  });

  it("discard_round: a Quick Round is gated on created_by alone, never combined with is_trip_captain", () => {
    const fn = sql.match(/create or replace function public\.discard_round[\s\S]*?\$\$;/)?.[0];
    expect(fn, "discard_round should exist").toBeTruthy();
    const quickRoundBranch = fn!.match(/if v_trip\.kind = 'quick_round' then([\s\S]*?)else/)?.[1];
    expect(quickRoundBranch, "quick_round branch should exist").toBeTruthy();
    expect(quickRoundBranch!).toMatch(/v_round\.created_by is distinct from auth\.uid\(\)/);
    expect(quickRoundBranch!).not.toMatch(/is_trip_captain/);
  });

  it("discard_round: every non-Quick-Round kind (Group Round, Trip Round) requires is_trip_captain", () => {
    const fn = sql.match(/create or replace function public\.discard_round[\s\S]*?\$\$;/)?.[0];
    const elseBranch = fn!.match(/else\s*\n\s*if not public\.is_trip_captain\(v_round\.trip_id\) then/);
    expect(elseBranch, "else branch should require is_trip_captain").not.toBeNull();
  });

  it("restore_round mirrors discard_round's exact authorization shape", () => {
    const fn = sql.match(/create or replace function public\.restore_round[\s\S]*?\$\$;/)?.[0];
    expect(fn, "restore_round should exist").toBeTruthy();
    const quickRoundBranch = fn!.match(/if v_trip\.kind = 'quick_round' then([\s\S]*?)else/)?.[1];
    expect(quickRoundBranch!).toMatch(/v_round\.created_by is distinct from auth\.uid\(\)/);
    expect(quickRoundBranch!).not.toMatch(/is_trip_captain/);
    expect(fn!).toMatch(/if not public\.is_trip_captain\(v_round\.trip_id\) then/);
  });

  it("both functions require an authenticated session before doing anything", () => {
    for (const fn of ["discard_round", "restore_round"]) {
      const fnSql = sql.match(new RegExp(`create or replace function public\\.${fn}[\\s\\S]*?\\$\\$;`))?.[0];
      expect(fnSql!).toMatch(/if auth\.uid\(\) is null then\s*\n\s*raise exception 'Not authenticated'/);
    }
  });

  it("both functions are SECURITY DEFINER with a locked-down search_path -- required for a SECURITY DEFINER function to be safe", () => {
    for (const fn of ["discard_round", "restore_round"]) {
      const fnSql = sql.match(new RegExp(`create or replace function public\\.${fn}[\\s\\S]*?\\$\\$;`))?.[0];
      expect(fnSql!).toMatch(/security definer/);
      expect(fnSql!).toMatch(/set search_path = public/);
    }
  });

  it("grants execute to authenticated only -- never to anon or public, so an unauthenticated caller can't even attempt it", () => {
    for (const fn of ["discard_round(uuid)", "restore_round(uuid)"]) {
      expect(sql).toMatch(new RegExp(`grant execute on function public\\.${fn.replace(/[()]/g, "\\$&")} to authenticated`));
      expect(sql).toMatch(new RegExp(`revoke execute on function public\\.${fn.replace(/[()]/g, "\\$&")} from public`));
      expect(sql).toMatch(new RegExp(`revoke execute on function public\\.${fn.replace(/[()]/g, "\\$&")} from anon`));
    }
  });

  it("both functions are idempotent (a repeat call is a harmless no-op, not an error) so a slow double-tap can't fail confusingly", () => {
    const discardFn = sql.match(/create or replace function public\.discard_round[\s\S]*?\$\$;/)?.[0];
    expect(discardFn!).toMatch(/if v_round\.deleted_at is not null then\s*\n\s*return;/);
    const restoreFn = sql.match(/create or replace function public\.restore_round[\s\S]*?\$\$;/)?.[0];
    expect(restoreFn!).toMatch(/if v_round\.deleted_at is null then\s*\n\s*return;/);
  });
});
