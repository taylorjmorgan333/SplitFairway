import * as React from "react";
import { cn } from "@/lib/utils";

const VARIANT_CLASSES = {
  neutral: "bg-cream-200 text-charcoal-700",
  forest: "bg-forest-800/10 text-forest-800",
  gold: "bg-gold-100 text-gold-800",
  success: "bg-emerald-100 text-emerald-800",
  warning: "bg-amber-100 text-amber-800",
} as const;

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof VARIANT_CLASSES;
}

export function Badge({ className, variant = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    />
  );
}
