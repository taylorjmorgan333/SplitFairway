import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { CreateTripForm } from "@/components/trips/create-trip-form";

export const metadata: Metadata = { title: "Create a trip" };

export default function NewTripPage() {
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl">Create a trip</h1>
      <p className="mt-1.5 text-sm text-charcoal-500">
        You&apos;ll be the trip&apos;s captain — you can add a co-treasurer,
        invite golfers, and add expenses once it&apos;s created.
      </p>

      <Card className="mt-6">
        <CardContent>
          <CreateTripForm />
        </CardContent>
      </Card>
    </div>
  );
}
