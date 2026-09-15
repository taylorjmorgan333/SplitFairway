import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GOLF_SCORING_ENABLED, GOLFCOURSE_API_ENABLED, GOLFCOURSE_API_SEARCH_ENABLED } from "@/lib/config";
import { GroupRoundStartWizard } from "@/components/groups/group-round-start-wizard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Start a Group Round" };

/**
 * The fast Group Round start wizard's data loader. Recently played
 * courses stay the fast path (spec item 2: "keep the normal
 * recent-course path fast"), but "Search All Courses" (also spec item
 * 2) means a group with zero round history is no longer a dead end --
 * the wizard renders unconditionally now, with an empty recent-courses
 * list simply meaning the search box opens by default (see
 * GroupRoundStartWizard's own showSearch default).
 */
export default async function GroupRoundStartPage({ params }: { params: Promise<{ groupId: string }> }) {
  if (!GOLF_SCORING_ENABLED) {
    redirect("/dashboard");
  }

  const { groupId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const [{ data: group }, { data: memberRows }, { data: presetRows }] = await Promise.all([
    supabase.from("golf_groups").select("id, name").eq("id", groupId).maybeSingle(),
    supabase
      .from("golf_group_members")
      .select("id, user_id, display_name, default_handicap_index, preferred_tee_name")
      .eq("group_id", groupId)
      .order("role", { ascending: true }),
    supabase
      .from("golf_group_game_presets")
      .select("id, name, side_game_type")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false }),
  ]);

  if (!group) {
    notFound();
  }

  const members = (memberRows ?? []).map((m) => ({
    id: m.id,
    userId: m.user_id,
    displayName: m.display_name,
    defaultHandicapIndex: m.default_handicap_index,
    preferredTeeName: m.preferred_tee_name,
  }));

  const { data: tripRows } = await supabase.from("trips").select("id").eq("golf_group_id", groupId);
  const tripIds = (tripRows ?? []).map((t) => t.id);

  const recentCourseIds: string[] = [];
  if (tripIds.length > 0) {
    const { data: roundRows } = await supabase
      .from("rounds")
      .select("course_id, round_date")
      .in("trip_id", tripIds)
      .order("round_date", { ascending: false })
      .limit(30);
    for (const r of roundRows ?? []) {
      if (r.course_id && !recentCourseIds.includes(r.course_id)) recentCourseIds.push(r.course_id);
      if (recentCourseIds.length >= 5) break;
    }
  }

  let recentCourses: { id: string; name: string; holeCount: number; teeSetNames: string[] }[] = [];
  if (recentCourseIds.length > 0) {
    const [{ data: courseRows }, { data: teeSetRows }] = await Promise.all([
      supabase.from("courses").select("id, name, hole_count").in("id", recentCourseIds),
      supabase.from("course_tee_sets").select("course_id, name").in("course_id", recentCourseIds),
    ]);
    const courseById = new Map((courseRows ?? []).map((c) => [c.id, c]));
    const teesByCourse = new Map<string, string[]>();
    for (const t of teeSetRows ?? []) {
      const list = teesByCourse.get(t.course_id) ?? [];
      list.push(t.name);
      teesByCourse.set(t.course_id, list);
    }
    recentCourses = recentCourseIds
      .map((id) => courseById.get(id))
      .filter((c): c is { id: string; name: string; hole_count: number } => !!c)
      .map((c) => ({ id: c.id, name: c.name, holeCount: c.hole_count, teeSetNames: teesByCourse.get(c.id) ?? [] }));
  }

  const presets = (presetRows ?? []).map((p) => ({ id: p.id, name: p.name, sideGameType: p.side_game_type }));

  return (
    <div className="mx-auto max-w-lg pb-10">
      <h1 className="text-2xl">Start a Round for {group.name}</h1>
      <GroupRoundStartWizard
        groupId={groupId}
        members={members}
        recentCourses={recentCourses}
        presets={presets}
        courseSearchEnabled={GOLFCOURSE_API_ENABLED && GOLFCOURSE_API_SEARCH_ENABLED}
      />
    </div>
  );
}
