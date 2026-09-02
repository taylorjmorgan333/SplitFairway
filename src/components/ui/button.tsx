import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const VARIANT_CLASSES = {
  primary:
    "bg-forest-800 text-cream-50 hover:bg-forest-700 active:bg-forest-900 shadow-card",
  gold: "bg-gold-400 text-forest-950 hover:bg-gold-300 active:bg-gold-500 shadow-card",
  outline:
    "border border-forest-800/20 text-forest-900 hover:bg-forest-50 active:bg-forest-100",
  ghost: "text-forest-900 hover:bg-forest-800/5 active:bg-forest-800/10",
} as const;

const SIZE_CLASSES = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-7 text-base",
} as const;

type Variant = keyof typeof VARIANT_CLASSES;
type Size = keyof typeof SIZE_CLASSES;

const baseClasses =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        baseClasses,
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    />
  );
}

interface ButtonLinkProps extends React.ComponentProps<typeof Link> {
  variant?: Variant;
  size?: Size;
  className?: string;
}

export function ButtonLink({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={cn(
        baseClasses,
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    />
  );
}
