import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { GOLF_SCORING_ENABLED } from "@/lib/config";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Group Round" };

export default async function PlayGroupPage() {
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

  const { data: memberships } = await supabase
    .from("golf_group_members")
    .select("group_id, golf_groups(id, name)")
    .eq("user_id", user.id);

  const groupRows = (memberships ?? []).filter((g) => g.golf_groups !== null);
  const groupIds = groupRows.map((g) => g.group_id);
  const { data: memberCountRows } = groupIds.length
    ? await supabase.from("golf_group_members").select("group_id").in("group_id", groupIds)
    : { data: [] as { group_id: string }[] };
  const memberCountByGroup = new Map<string, number>();
  for (const r of memberCountRows ?? []) {
    memberCountByGroup.set(r.group_id, (memberCountByGroup.get(r.group_id) ?? 0) + 1);
  }
  const groups = groupRows.map((g) => ({
    id: g.golf_groups!.id,
    name: g.golf_groups!.name,
    memberCount: memberCountByGroup.get(g.group_id) ?? 1,
  }));

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl">Group Round</h1>
      <p className="mt-1.5 text-base text-charcoal-500">Choose which saved group is playing.</p>

      {groups.length === 0 ? (
        <Card className="mt-8 flex flex-col items-center border border-dashed border-forest-900/15 bg-white/60 px-6 py-12 text-center shadow-none">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-forest-800/10">
            <Users className="h-5 w-5 text-forest-700" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <h2 className="mt-5 text-xl text-forest-900">No saved groups yet</h2>
          <p className="mt-2 max-w-sm text-base text-charcoal-500">
            Save your regular golfers once, then start a round with them any time.
          </p>
          <ButtonLink href="/groups/new" variant="primary" className="mt-6">
            Create a Group
          </ButtonLink>
        </Card>
      ) : (
        <div className="mt-8 space-y-3">
          {groups.map((group) => (
            <Link key={group.id} href={`/play/group/${group.id}/start`} className="block w-full text-left">
              <Card className="flex items-center gap-4 p-5 transition-shadow hover:shadow-card-hover">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-forest-800/10">
                  <Users className="h-5 w-5 text-forest-700" aria-hidden="true" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-medium text-forest-900">{group.name}</p>
                  <p className="mt-0.5 text-base text-charcoal-500">
                    {group.memberCount} {group.memberCount === 1 ? "golfer" : "golfers"}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-charcoal-400" aria-hidden="true" />
              </Card>
            </Link>
          ))}
          <Link href="/groups/new" className="block text-center text-base font-medium text-forest-800 underline">
            Create a new group instead
          </Link>
        </div>
      )}
    </div>
  );
}
