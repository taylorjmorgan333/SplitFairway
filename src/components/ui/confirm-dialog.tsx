"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * The one confirmation pattern every destructive action in the round
 * redesign uses (removing a golfer, removing a group): plain-language
 * title/description, a clearly-labeled confirm button that names the
 * actual action (never a bare "OK"), and a non-destructive way out that
 * is just as prominent. Replaces small, easy-to-miss inline "Remove"
 * text links.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!pending) onOpenChange(false);
      }}
      title={title}
      description={description}
    >
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" size="lg" onClick={() => onOpenChange(false)} disabled={pending}>
          {cancelLabel}
        </Button>
        <Button
          type="button"
          size="lg"
          className="bg-red-600 text-white hover:bg-red-700 active:bg-red-800"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            setError(null);
            try {
              await onConfirm();
              onOpenChange(false);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
            } finally {
              setPending(false);
            }
          }}
        >
          {pending ? "Working…" : confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
