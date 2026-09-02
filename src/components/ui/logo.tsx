import { cn } from "@/lib/utils";

/**
 * Wordmark with a minimal flagstick-and-pin monogram. Intentionally
 * restrained — a single thin line and dot, not a literal flag icon.
 */
export function Logo({
  className,
  variant = "dark",
}: {
  className?: string;
  variant?: "dark" | "light";
}) {
  const textColor = variant === "dark" ? "text-forest-900" : "text-cream-50";
  const strokeColor = variant === "dark" ? "#183020" : "#F8F3E9";

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg
        width="20"
        height="24"
        viewBox="0 0 20 24"
        fill="none"
        aria-hidden="true"
      >
        <line
          x1="4"
          y1="1.5"
          x2="4"
          y2="22.5"
          stroke={strokeColor}
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <circle cx="4" cy="22" r="1.6" fill="#C9A24E" />
        <path d="M4.5 2.2L16 5.6L4.5 9V2.2Z" fill="#C9A24E" />
      </svg>
      <span
        className={cn(
          "font-serif text-lg tracking-tightish",
          textColor,
        )}
      >
        Golf Trip Treasurer
      </span>
    </span>
  );
}
