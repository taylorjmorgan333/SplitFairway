import type { Metadata } from "next";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Create a trip" };

export default function NewTripPage() {
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl">Create a trip</h1>
      <p className="mt-1.5 text-sm text-charcoal-500">
        Set the basics now — you&apos;ll add expenses and invite golfers
        next.
      </p>

      <Alert variant="info" className="mt-6">
        Trip creation is coming soon. This screen shows the form we&apos;re
        building — saving a trip isn&apos;t wired up yet.
      </Alert>

      <Card className="mt-6">
        <CardContent>
          <form className="space-y-5" aria-disabled="true">
            <FormField id="name" label="Trip name">
              <Input
                name="name"
                type="text"
                placeholder="e.g. Pebble Ridge Fall Trip"
                disabled
              />
            </FormField>

            <FormField id="destination" label="Destination">
              <Input name="destination" type="text" placeholder="e.g. Bandon, OR" disabled />
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField id="startDate" label="Start date">
                <Input name="startDate" type="date" disabled />
              </FormField>
              <FormField id="endDate" label="End date">
                <Input name="endDate" type="date" disabled />
              </FormField>
            </div>

            <Button type="submit" className="w-full" disabled>
              Create trip
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
