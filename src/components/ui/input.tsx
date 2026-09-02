import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-11 w-full rounded-lg border border-charcoal-400/25 bg-white px-3.5 text-sm text-charcoal placeholder:text-charcoal-400",
        "transition-colors focus:border-forest-600",
        "disabled:cursor-not-allowed disabled:bg-cream-100 disabled:opacity-70",
        "aria-[invalid=true]:border-red-400 aria-[invalid=true]:focus:border-red-500",
        className,
      )}
      {...props}
    />
  );
});
