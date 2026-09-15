import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guest scoring access (spec item 1) lives almost entirely in SQL --
 * RLS policies and SECURITY DEFINER RPCs -- which this project has no
 * live-database test harness to exercise directly (vitest here runs
 * in a plain Node environment; see vitest.config.ts). Rather than
 * skip testing "guest access isolation" and "guest score-entry
 * permissions" entirely, this reads the actual applied migration
 * files back off disk and asserts the specific, security-critical
 * lines are still there -- a regression guard against someone later
 * loosening a grant or swapping a predicate back to the unscoped one
 * without meaning to. It is not a substitute for the manual
 * captain/member/guest test pass (see the Phase 2 cleanup report),
 * only a safety net underneath it.
 */

const MIGRATIONS_DIR = join(__dirname, "../../../supabase/migrations");

function readMigration(filename: string): string {
  return readFileSync(join(MIGRATIONS_DIR, filename), "utf-8");
}

describe("guest scoring access migrations", () => {
  const accessSql = readMigration("20260916170000_guest_scoring_access.sql");
  const tableSql = readMigration("20260916180000_guest_invitations_table.sql");
  const rpcSql = readMigration("20260916190000_guest_invitation_rpcs.sql");

  it("adds is_guest to trip_members, defaulting to false for every existing member", () => {
    expect(accessSql).toMatch(/add column is_guest boolean not null default false/);
  });

  it("keeps is_full_trip_member as is_trip_member AND NOT guest -- never a separate, divergent check", () => {
    expect(accessSql).toMatch(
      /select public\.is_trip_member\(p_trip_id\) and not public\.is_guest_trip_member\(p_trip_id\)/,
    );
  });

  it("gates every financial/audit SELECT policy behind is_full_trip_member, not bare is_trip_member", () => {
    for (const table of ["expenses", "expense_shares", "payments", "activity_log"]) {
      const policyMatch = accessSql.match(
        new RegExp(`create policy "${table}_select_members"[\\s\\S]*?;`),
      );
      expect(policyMatch, `${table}_select_members policy should exist`).not.toBeNull();
      expect(policyMatch![0]).toMatch(/is_full_trip_member/);
      expect(policyMatch![0]).not.toMatch(/using \(public\.is_trip_member\(/);
    }
  });

  it("never touches the intentionally-shared trip_members payment columns with DDL", () => {
    // The migration's own comment explains *why* it leaves these columns
    // alone (mentioning them by name in prose), so strip comment lines
    // before checking -- this must catch an actual schema-changing
    // statement referencing them, not just the words appearing in a
    // "-- ..." explanation.
    const codeOnly = accessSql
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");
    expect(codeOnly).not.toMatch(/payment_handle/);
    expect(codeOnly).not.toMatch(/preferred_payment_method/);
  });

  it("keeps the guest invitations table captain-only to read, with no public insert/update policy", () => {
    expect(tableSql).toMatch(/enable row level security/);
    expect(tableSql).toMatch(
      /create policy "golf_group_guest_invitations_select_captain"[\s\S]*?is_trip_captain\(trip_id\)/,
    );
    expect(tableSql).not.toMatch(/create policy .*_insert_/);
    expect(tableSql).not.toMatch(/create policy .*_update_/);
  });

  it("requires trip-captain authorization to create, revoke, and regenerate a guest invitation", () => {
    for (const fn of [
      "create_group_guest_invitation",
      "revoke_group_guest_invitation",
      "regenerate_group_guest_invitation",
    ]) {
      const fnMatch = rpcSql.match(new RegExp(`create or replace function public\\.${fn}\\([\\s\\S]*?\\$\\$;`));
      expect(fnMatch, `${fn} should exist`).not.toBeNull();
      expect(fnMatch![0]).toMatch(/is_trip_captain/);
    }
  });

  it("never grants the guest-management RPCs to anon", () => {
    for (const fn of [
      "create_group_guest_invitation(uuid, uuid, text, uuid)",
      "redeem_group_guest_invitation(text)",
      "revoke_group_guest_invitation(uuid)",
      "regenerate_group_guest_invitation(uuid)",
    ]) {
      expect(rpcSql).toMatch(new RegExp(`revoke execute on function public\\.${fn.replace(/[()]/g, "\\$&")} from anon`));
    }
  });

  it("only ever grants the anon-callable preview function select-shaped, minimal data intent (never roster/financial fields)", () => {
    const previewMatch = rpcSql.match(
      /create or replace function public\.get_guest_invitation_preview[\s\S]*?\$\$;/,
    );
    expect(previewMatch).not.toBeNull();
    for (const forbidden of ["trip_members", "expenses", "payments", "hole_scores", "round_players"]) {
      expect(previewMatch![0]).not.toMatch(new RegExp(`from public\\.${forbidden}`));
    }
  });

  it("requires an authenticated session (anonymous or real) before redeeming, never anon", () => {
    expect(rpcSql).toMatch(/if auth\.uid\(\) is null then\s*\n\s*raise exception 'Not authenticated'/);
  });

  it("cuts off live access immediately on revoke by deactivating the linked trip_members row, not just the invitation", () => {
    const revokeMatch = rpcSql.match(/create or replace function public\.revoke_group_guest_invitation[\s\S]*?\$\$;/);
    expect(revokeMatch).not.toBeNull();
    expect(revokeMatch![0]).toMatch(/update public\.trip_members set status = 'removed'/);
  });
});
