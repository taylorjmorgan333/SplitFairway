import * as React from "react";
import { CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const VARIANT_CONFIG = {
  success: {
    classes: "bg-emerald-50 text-emerald-900 border-emerald-200",
    icon: CheckCircle2,
  },
  error: {
    classes: "bg-red-50 text-red-900 border-red-200",
    icon: AlertTriangle,
  },
  info: {
    classes: "bg-forest-50 text-forest-900 border-forest-200",
    icon: Info,
  },
} as const;

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: keyof typeof VARIANT_CONFIG;
}

export function Alert({ className, variant = "info", children, ...props }: AlertProps) {
  const { classes, icon: Icon } = VARIANT_CONFIG[variant];
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm",
        classes,
        className,
      )}
      {...props}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
