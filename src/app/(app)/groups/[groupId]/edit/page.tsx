import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { EditGroupForm } from "@/components/groups/edit-group-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit Group" };

export default async function EditGroupPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: group } = await supabase.from("golf_groups").select("id, name, description").eq("id", groupId).maybeSingle();
  if (!group) {
    notFound();
  }

  const { data: me } = await supabase
    .from("golf_group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (me?.role !== "owner") {
    redirect(`/groups/${groupId}`);
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl">Edit Group</h1>
      <Card className="mt-6">
        <CardContent>
          <EditGroupForm groupId={groupId} name={group.name} description={group.description} />
        </CardContent>
      </Card>
    </div>
  );
}
