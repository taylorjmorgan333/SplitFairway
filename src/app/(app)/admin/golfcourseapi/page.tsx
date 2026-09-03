import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  GOLF_SCORING_ENABLED,
  GOLFCOURSE_API_ENABLED,
  GOLFCOURSE_API_SEARCH_ENABLED,
  GOLFCOURSE_API_REFRESH_ENABLED,
  GOLFCOURSE_API_DAILY_REQUEST_LIMIT,
} from "@/lib/config";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "GolfCourseAPI usage" };

/**
 * Admin-only usage/status dashboard for the GolfCourseAPI integration --
 * requests used today vs. the configured daily ceiling, success/failure/
 * rate-limited/cache-hit counts, and the most recent requests. Never
 * shown to ordinary users (course_provider_requests_select_admin RLS
 * backs this up even if this page-level check were somehow bypassed) --
 * see supabase/migrations/20260903100000_golfcourseapi_provider_integration.sql.
 */
export default async function GolfCourseApiAdminPage() {
  if (!GOLF_SCORING_ENABLED) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: isAdmin } = await supabase.rpc("is_app_admin");
  if (!isAdmin) {
    redirect("/dashboard");
  }

  const startOfDayUtc = new Date();
  startOfDayUtc.setUTCHours(0, 0, 0, 0);

  const { data: todayRows } = await supabase
    .from("course_provider_requests")
    .select("operation, cache_hit, status_code, sanitized_error_code, created_at")
    .gte("created_at", startOfDayUtc.toISOString())
    .order("created_at", { ascending: false });

  const rows = todayRows ?? [];
  const realRequests = rows.filter((r) => r.status_code !== null);
  const usedToday = realRequests.length;
  const successCount = realRequests.filter((r) => r.status_code !== null && r.status_code < 400).length;
  const failedCount = realRequests.length - successCount;
  const rateLimitedCount = rows.filter((r) => r.sanitized_error_code === "rate_limited").length;
  const cacheHitCount = rows.filter((r) => r.cache_hit).length;
  const lastSuccessful = realRequests.find((r) => r.status_code !== null && r.status_code < 400);

  const { data: recent } = await supabase
    .from("course_provider_requests")
    .select("operation, cache_hit, status_code, sanitized_error_code, created_at")
    .order("created_at", { ascending: false })
    .limit(25);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl">GolfCourseAPI usage</h1>
        <Link href="/admin/course-corrections" className="text-sm text-charcoal-500 underline underline-offset-2">
          Course corrections →
        </Link>
      </div>
      <p className="mt-1.5 text-sm text-charcoal-500">Admin-only. Never shown to ordinary users.</p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Feature flags</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Badge variant={GOLFCOURSE_API_ENABLED ? "success" : "neutral"}>
            GOLFCOURSE_API_ENABLED: {String(GOLFCOURSE_API_ENABLED)}
          </Badge>
          <Badge variant={GOLFCOURSE_API_SEARCH_ENABLED ? "success" : "neutral"}>
            SEARCH_ENABLED: {String(GOLFCOURSE_API_SEARCH_ENABLED)}
          </Badge>
          <Badge variant={GOLFCOURSE_API_REFRESH_ENABLED ? "success" : "neutral"}>
            REFRESH_ENABLED: {String(GOLFCOURSE_API_REFRESH_ENABLED)}
          </Badge>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Today</CardTitle>
          <CardDescription>Resets at 00:00 UTC. Cache hits and locally-blocked attempts don&apos;t count against the daily limit.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stat label="Used today" value={`${usedToday} / ${GOLFCOURSE_API_DAILY_REQUEST_LIMIT}`} />
          <Stat label="Successful" value={String(successCount)} />
          <Stat label="Failed" value={String(failedCount)} />
          <Stat label="Rate-limited" value={String(rateLimitedCount)} />
          <Stat label="Cache hits" value={String(cacheHitCount)} />
          <Stat
            label="Last success"
            value={lastSuccessful ? new Date(lastSuccessful.created_at).toLocaleTimeString() : "—"}
          />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent requests</CardTitle>
        </CardHeader>
        <CardContent>
          {(!recent || recent.length === 0) && (
            <p className="text-sm text-charcoal-400">No requests logged yet.</p>
          )}
          {recent && recent.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs text-charcoal-400">
                    <th className="py-1 pr-3">When</th>
                    <th className="py-1 pr-3">Operation</th>
                    <th className="py-1 pr-3">Cache</th>
                    <th className="py-1 pr-3">Status</th>
                    <th className="py-1">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r, i) => (
                    <tr key={i} className="border-t border-charcoal-400/10">
                      <td className="py-1.5 pr-3 text-charcoal-500">
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                      <td className="py-1.5 pr-3">{r.operation}</td>
                      <td className="py-1.5 pr-3">{r.cache_hit ? "hit" : "—"}</td>
                      <td className="py-1.5 pr-3">{r.status_code ?? "—"}</td>
                      <td className="py-1.5 text-red-700">{r.sanitized_error_code ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-charcoal-400">{label}</p>
      <p className="text-lg font-medium text-forest-900">{value}</p>
    </div>
  );
}
