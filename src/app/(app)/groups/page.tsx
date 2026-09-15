import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Users, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Groups" };

export default async function GroupsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: memberships } = await supabase
    .from("golf_group_members")
    .select("group_id, role, golf_groups(id, name, description)")
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

  const groups = groupRows
    .map((g) => ({
      id: g.golf_groups!.id,
      name: g.golf_groups!.name,
      description: g.golf_groups!.description,
      memberCount: memberCountByGroup.get(g.group_id) ?? 1,
      isOwner: g.role === "owner",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl">Groups</h1>
          <p className="mt-1.5 text-base text-charcoal-500">
            Your regular golfers, saved once — golfers, handicaps, preferred tees and game
            presets, ready every time you play.
          </p>
        </div>
        <ButtonLink href="/groups/new" variant="primary" size="md" className="hidden shrink-0 sm:inline-flex">
          Create Group
        </ButtonLink>
      </div>

      {groups.length === 0 ? (
        <Card className="mt-8 flex flex-col items-center border border-dashed border-forest-900/15 bg-white/60 px-6 py-16 text-center shadow-none">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-forest-800/10">
            <Users className="h-5 w-5 text-forest-700" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <h2 className="mt-5 text-xl text-forest-900">No groups yet</h2>
          <p className="mt-2 max-w-sm text-base text-charcoal-500">
            Save your regular Saturday foursome — or any group you play with often — and start a
            round with them in two taps.
          </p>
          <ButtonLink href="/groups/new" variant="primary" className="mt-6">
            Create a Group
          </ButtonLink>
        </Card>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {groups.map((group) => (
            <Link key={group.id} href={`/groups/${group.id}`} className="block">
              <Card className="flex items-center gap-4 p-5 transition-shadow hover:shadow-card-hover">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-forest-800/10">
                  <Users className="h-6 w-6 text-forest-700" aria-hidden="true" strokeWidth={1.75} />
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
        </div>
      )}

      <ButtonLink href="/groups/new" variant="primary" size="lg" className="mt-8 flex w-full justify-center sm:hidden">
        Create Group
      </ButtonLink>
    </div>
  );
}
