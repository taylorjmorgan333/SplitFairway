import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { CreateGroupForm } from "@/components/groups/create-group-form";

export const metadata: Metadata = { title: "Create a Group" };

export default function NewGroupPage() {
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl">Create a Group</h1>
      <p className="mt-1.5 text-base text-charcoal-500">
        You&apos;ll be the group&apos;s owner — add your regular golfers next, along with their
        handicaps and preferred tees.
      </p>

      <Card className="mt-6">
        <CardContent>
          <CreateGroupForm />
        </CardContent>
      </Card>
    </div>
  );
}
