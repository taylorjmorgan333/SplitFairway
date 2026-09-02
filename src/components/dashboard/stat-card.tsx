import { type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: "default" | "gold";
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-charcoal-500">{label}</p>
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full",
            tone === "gold" ? "bg-gold-100" : "bg-forest-800/10",
          )}
        >
          <Icon
            className={cn(
              "h-4 w-4",
              tone === "gold" ? "text-gold-700" : "text-forest-700",
            )}
            strokeWidth={1.75}
            aria-hidden="true"
          />
        </span>
      </div>
      <p className="mt-3 font-serif text-2xl text-forest-900">{value}</p>
    </Card>
  );
}
