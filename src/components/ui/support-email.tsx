import { SUPPORT_EMAIL } from "@/lib/config";

/**
 * Renders the real support mailto link when NEXT_PUBLIC_SUPPORT_EMAIL is
 * set, or a visibly "not configured" notice when it isn't — never a
 * placeholder address that looks real. Used anywhere the app shows a
 * support contact (Contact page, data-deletion page, ...).
 */
export function SupportEmail({ className }: { className?: string }) {
  if (!SUPPORT_EMAIL) {
    return (
      <span
        className={
          className ??
          "inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-sm font-medium text-red-700"
        }
      >
        Support email not configured — set NEXT_PUBLIC_SUPPORT_EMAIL
      </span>
    );
  }

  return (
    <a href={`mailto:${SUPPORT_EMAIL}`} className={className ?? "text-forest-800 underline"}>
      {SUPPORT_EMAIL}
    </a>
  );
}
