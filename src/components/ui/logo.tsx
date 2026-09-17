import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Wordmark paired with the SplitFairway crest (public/logo.png — a
 * self-contained badge with its own dark-green/cream/gold palette and a
 * transparent background), so it reads correctly on both light and dark
 * page backgrounds without needing separate art per variant.
 */
export function Logo({
  className,
  variant = "dark",
  hideWordmarkBelowSm = false,
}: {
  className?: string;
  variant?: "dark" | "light";
  /** Collapses to just the crest icon below the sm breakpoint. Used by
   * SiteHeader, where the full wordmark plus the primary CTA button
   * and menu toggle no longer fit side by side on a phone-width
   * screen without overlapping. Defaults to false everywhere else
   * (footer, hero phone mockup) so nothing else changes. */
  hideWordmarkBelowSm?: boolean;
}) {
  const textColor = variant === "dark" ? "text-forest-900" : "text-cream-50";

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Image
        src="/logo.png"
        alt=""
        aria-hidden="true"
        width={23}
        height={40}
        className="h-10 w-auto shrink-0"
        priority
      />
      <span
        className={cn(
          "font-wordmark text-base uppercase tracking-wider",
          textColor,
          hideWordmarkBelowSm && "hidden sm:inline",
        )}
      >
        SplitFairway
      </span>
    </span>
  );
}
