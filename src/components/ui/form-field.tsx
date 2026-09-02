import * as React from "react";
import { Label } from "@/components/ui/label";

interface FormFieldProps {
  id: string;
  label: string;
  children: React.ReactNode;
  errors?: string[];
  hint?: string;
}

/**
 * Wraps a form input with a label and, when validation fails, an
 * accessible error message linked via aria-describedby.
 */
export function FormField({ id, label, children, errors, hint }: FormFieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const hasError = Boolean(errors && errors.length > 0);

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      {React.isValidElement(children)
        ? React.cloneElement(
            children as React.ReactElement<{
              id?: string;
              "aria-invalid"?: boolean;
              "aria-describedby"?: string;
            }>,
            {
              id,
              "aria-invalid": hasError,
              "aria-describedby": hasError
                ? errorId
                : hint
                  ? hintId
                  : undefined,
            },
          )
        : children}
      {hint && !hasError && (
        <p id={hintId} className="mt-1.5 text-xs text-charcoal-400">
          {hint}
        </p>
      )}
      {hasError && (
        <p id={errorId} role="alert" className="mt-1.5 text-xs text-red-600">
          {errors![0]}
        </p>
      )}
    </div>
  );
}
