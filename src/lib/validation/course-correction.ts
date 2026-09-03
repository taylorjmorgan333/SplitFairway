import { z } from "zod";

export const ISSUE_TYPE_VALUES = [
  "wrong_par",
  "wrong_yardage",
  "wrong_tee_name",
  "missing_tee",
  "wrong_stroke_index",
  "duplicate_course",
  "closed_or_renamed",
  "other",
] as const;

export const ISSUE_TYPE_LABELS: Record<(typeof ISSUE_TYPE_VALUES)[number], string> = {
  wrong_par: "Wrong par",
  wrong_yardage: "Wrong yardage",
  wrong_tee_name: "Wrong tee name",
  missing_tee: "Missing a tee set",
  wrong_stroke_index: "Wrong stroke index",
  duplicate_course: "Duplicate course",
  closed_or_renamed: "Course closed or renamed",
  other: "Something else",
};

export const courseCorrectionSchema = z.object({
  issueType: z.enum(ISSUE_TYPE_VALUES),
  holeNumber: z
    .union([z.coerce.number().int().min(1).max(18), z.literal(""), z.undefined()])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  currentValue: z
    .union([z.string().trim().max(200), z.literal(""), z.undefined()])
    .optional()
    .transform((v) => (v ? v : null)),
  proposedValue: z
    .union([z.string().trim().max(200), z.literal(""), z.undefined()])
    .optional()
    .transform((v) => (v ? v : null)),
  reason: z.string().trim().min(1, "Tell us what's wrong").max(500),
});

export type CourseCorrectionInput = z.infer<typeof courseCorrectionSchema>;
