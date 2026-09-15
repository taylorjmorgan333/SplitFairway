import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  GOLF_SCORING_ENABLED,
  GOLFCOURSE_API_ENABLED,
  GOLFCOURSE_API_SEARCH_ENABLED,
  MANUAL_COURSE_ENTRY_ENABLED,
  SIDE_GAMES_ENABLED,
} from "@/lib/config";
import { mergeQuickRoundCourseChoices, type QuickRoundCourseChoice } from "@/lib/golf/quick-round-course-list";
import { QuickRoundSetup } from "@/components/rounds/quick-round-setup";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Quick Round" };

const RECENT_COURSE_LOOKBACK = 60;
const MAX_COURSE_CHOICES = 12;

/**
 * The Quick Round single-screen setup's data loader (spec: "Replace it
 * with one mobile-first setup screen"). Everything the screen needs to
 * render its already-correct-by-default state in one pass: this
 * golfer's saved and recently-played courses (their own history across
 * every trip they've ever played in -- not scoped to one group, unlike
 * the Group Round wizard's recent-courses query), their golf profile
 * (for the auto-filled handicap/tee), and the feature flags the client
 * component needs threaded as props (server-only env flags read as
 * undefined in a "use client" file).
 */
export default async function QuickRoundSetupPage() {
  if (!GOLF_SCORING_ENABLED) {
    redirect("/home");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, { data: golfProfile }, { data: favoriteRows }, { data: myTripMemberRows }] =
    await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
      supabase
        .from("golf_profiles")
        .select("handicap_index, handicap_source, preferred_tee")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("course_favorites")
        .select("course_id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase.from("trip_members").select("trip_id").eq("user_id", user.id),
    ]);

  const selfDisplayName = profile?.full_name || user.email?.split("@")[0] || "You";

  const tripIds = Array.from(new Set((myTripMemberRows ?? []).map((m) => m.trip_id)));

  // This golfer's own round history across every trip they've ever
  // played in (Quick Round, Group Round, or a real Trip) -- distinct
  // from the Group Round wizard's recent-courses query, which is scoped
  // to one saved group's trips only.
  const lastPlayedByCourseId = new Map<string, string>();
  let recentCourseIds: string[] = [];
  if (tripIds.length > 0) {
    const { data: roundRows } = await supabase
      .from("rounds")
      .select("course_id, round_date")
      .in("trip_id", tripIds)
      .order("round_date", { ascending: false })
      .limit(RECENT_COURSE_LOOKBACK);
    for (const r of roundRows ?? []) {
      if (!r.course_id) continue;
      if (!lastPlayedByCourseId.has(r.course_id)) {
        lastPlayedByCourseId.set(r.course_id, r.round_date);
      }
      if (!recentCourseIds.includes(r.course_id)) {
        recentCourseIds.push(r.course_id);
      }
    }
  }
  recentCourseIds = recentCourseIds.slice(0, MAX_COURSE_CHOICES);

  const favoriteCourseIds = (favoriteRows ?? []).map((f) => f.course_id);
  const allCourseIds = Array.from(new Set([...favoriteCourseIds, ...recentCourseIds]));

  let courseById = new Map<
    string,
    { id: string; name: string; city: string | null; state: string | null; hole_count: number }
  >();
  const teesByCourse = new Map<string, string[]>();
  if (allCourseIds.length > 0) {
    const [{ data: courseRows }, { data: teeSetRows }] = await Promise.all([
      supabase.from("courses").select("id, name, city, state, hole_count").in("id", allCourseIds),
      supabase.from("course_tee_sets").select("course_id, name").in("course_id", allCourseIds),
    ]);
    courseById = new Map((courseRows ?? []).map((c) => [c.id, c]));
    for (const t of teeSetRows ?? []) {
      const list = teesByCourse.get(t.course_id) ?? [];
      list.push(t.name);
      teesByCourse.set(t.course_id, list);
    }
  }

  function toChoice(courseId: string, favorited: boolean): QuickRoundCourseChoice | null {
    const course = courseById.get(courseId);
    if (!course) return null;
    return {
      id: course.id,
      name: course.name,
      city: course.city,
      state: course.state,
      holeCount: course.hole_count,
      teeSetNames: teesByCourse.get(course.id) ?? [],
      favorited,
      lastPlayedDate: lastPlayedByCourseId.get(course.id) ?? null,
    };
  }

  const favoriteCourses = favoriteCourseIds
    .map((id) => toChoice(id, true))
    .filter((c): c is QuickRoundCourseChoice => c !== null);
  const recentCourses = recentCourseIds
    .map((id) => toChoice(id, false))
    .filter((c): c is QuickRoundCourseChoice => c !== null);

  const courseChoices = mergeQuickRoundCourseChoices(favoriteCourses, recentCourses);

  return (
    <QuickRoundSetup
      selfDisplayName={selfDisplayName}
      golfProfile={{
        handicapIndex: golfProfile?.handicap_index ?? null,
        handicapSource: golfProfile?.handicap_source ?? null,
        preferredTee: golfProfile?.preferred_tee ?? null,
      }}
      courseChoices={courseChoices}
      courseSearchEnabled={GOLFCOURSE_API_ENABLED && GOLFCOURSE_API_SEARCH_ENABLED}
      manualCourseEntryEnabled={MANUAL_COURSE_ENTRY_ENABLED}
      sideGamesEnabled={SIDE_GAMES_ENABLED}
    />
  );
}
