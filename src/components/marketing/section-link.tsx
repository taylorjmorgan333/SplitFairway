"use client";

import Link, { type LinkProps } from "next/link";
import type { AnchorHTMLAttributes, MouseEvent } from "react";
import { buttonClasses, type Variant, type Size } from "@/components/ui/button";

type SectionLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
    variant?: Variant;
    size?: Size;
  };

/**
 * Drop-in replacement for next/link (or ButtonLink) used anywhere the
 * homepage links to one of its own sections -- header/footer nav
 * ("/#trip-mode" etc.), the hero's "Explore Trip Mode" button, and the
 * use-case cards' matching CTA.
 *
 * Why this exists: on this page, letting the browser handle the hash
 * jump itself (native fragment navigation on load, next/link's default
 * click handling, or a plain scrollIntoView/scrollTop call) has been
 * observed to update the URL hash without moving the viewport at all --
 * the scroll silently no-ops. Forcing an explicit `behavior: "instant"` in
 * scrollTo sidesteps whatever is swallowing the animated scroll and
 * reliably lands on the target section. This only intercepts same-page
 * hash hrefs; anything else (e.g. "/signup") behaves exactly like a
 * normal Link.
 */
export function SectionLink({
  href,
  variant,
  size,
  className,
  onClick,
  ...rest
}: SectionLinkProps) {
  const finalClassName =
    variant !== undefined || size !== undefined
      ? buttonClasses({ variant, size, className })
      : className;

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    onClick?.(e);
    if (e.defaultPrevented) return;

    const hrefStr = href.toString();
    const hashIndex = hrefStr.indexOf("#");
    if (hashIndex === -1) return;

    const path = hrefStr.slice(0, hashIndex) || "/";
    if (path !== window.location.pathname) return;

    const id = hrefStr.slice(hashIndex + 1);
    const target = document.getElementById(id);
    if (!target) return;

    e.preventDefault();
    const top = target.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top, behavior: "instant" });
    window.history.pushState(null, "", `#${id}`);
  }

  return <Link href={href} className={finalClassName} onClick={handleClick} {...rest} />;
}
