"use client";

import { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";

/**
 * A tap-to-open explanation for a term a first-time or older golfer
 * might not know (e.g. "playing handicap"). Deliberately click/tap
 * triggered rather than hover-only -- hover doesn't exist on a phone,
 * which is the primary device this redesign targets.
 */
export function InfoTip({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocPointer(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocPointer);
    document.addEventListener("touchstart", onDocPointer);
    return () => {
      document.removeEventListener("mousedown", onDocPointer);
      document.removeEventListener("touchstart", onDocPointer);
    };
  }, [open]);

  return (
    <span className="relative inline-flex" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={label}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-charcoal-400 hover:text-forest-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-500"
      >
        <Info className="h-4 w-4" aria-hidden="true" />
      </button>
      {open && (
        <div
          role="tooltip"
          className="absolute left-1/2 top-full z-30 mt-1.5 w-64 -translate-x-1/2 rounded-lg border border-forest-900/10 bg-white p-3 text-left text-xs leading-relaxed text-charcoal-600 shadow-lg"
        >
          {children}
        </div>
      )}
    </span>
  );
}
