import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge conditional class names and resolve Tailwind conflicts.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number of cents as USD currency, e.g. 125000 -> "$1,250.00".
 */
export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

/**
 * Format an ISO date string as a short, human-readable date.
 */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

/**
 * Format a "HH:MM:SS" (or "HH:MM") tee time as a plain 12-hour clock
 * reading, e.g. "15:30:00" -> "3:30 PM" -- easier to read at a glance
 * than the raw 24-hour string other round surfaces show today.
 */
export function formatTeeTime(time: string): string {
  const [hourStr, minuteStr] = time.split(":");
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return time;
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

/**
 * Parse a user-entered dollar amount ("12.5", "$1,250.00") into integer
 * cents. Returns null if the input isn't a valid non-negative amount —
 * callers should treat that as a validation failure, never coerce it to
 * 0 silently (money is never allowed to round away like that).
 */
export function parseDollarsToCents(input: FormDataEntryValue | null): number | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim().replace(/[$,]/g, "");
  if (trimmed === "" || !/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const cents = Math.round(Number(trimmed) * 100);
  return Number.isFinite(cents) ? cents : null;
}

/**
 * Format integer cents back into a plain decimal string suitable for a
 * form's default value, e.g. 125000 -> "1250.00".
 */
export function centsToDollarInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * True only for a same-site relative path — never a full URL, and
 * never a protocol-relative "//evil.com" URL. Used to validate a
 * `?next=` redirect target that ultimately comes from a query string
 * (attacker-controlled) before it's echoed into a hidden form field or
 * used in a redirect.
 */
export function isSafeRelativePath(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//");
}
