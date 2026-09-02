import Link from "next/link";
import { MapPin, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface TripSummary {
  id: string;
  name: string;
  destination?: string;
  dateRange: string;
  golferCount: number;
  outstandingLabel: string;
  status: "upcoming" | "past";
}

export function TripCard({ trip }: { trip: TripSummary }) {
  return (
    <Link href={`/trips/${trip.id}`} className="block">
      <Card className="p-5 transition-shadow hover:shadow-card-hover">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base text-forest-900">{trip.name}</h3>
            {trip.destination && (
              <p className="mt-1 flex items-center gap-1 text-xs text-charcoal-400">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                {trip.destination}
              </p>
            )}
          </div>
          <Badge variant={trip.status === "upcoming" ? "forest" : "neutral"}>
            {trip.status === "upcoming" ? "Upcoming" : "Past"}
          </Badge>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-cream-200 pt-4 text-sm">
          <span className="text-charcoal-500">{trip.dateRange}</span>
          <span className="flex items-center gap-1 text-charcoal-500">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            {trip.golferCount}
          </span>
        </div>

        <p className="mt-3 text-sm font-medium text-forest-900">
          {trip.outstandingLabel}
        </p>
      </Card>
    </Link>
  );
}
