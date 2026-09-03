import { z } from "zod";

export const HOLE_COUNT_VALUES = [9, 18] as const;

/**
 * A course, as entered by the golfer who created it — see
 * supabase/migrations/20260903030000_courses.sql. Every field here is
 * typed in by hand; this app never scrapes course data. (A course can
 * also be imported from GolfCourseAPI, a licensed provider the user has
 * their own account for — see src/actions/course-import.ts — but that
 * path doesn't go through this schema, since the imported fields come
 * from the provider's response, not a form submission.)
 */
export const courseSchema = z.object({
  name: z.string().trim().min(2, "Enter a course name").max(160),
  city: z.string().trim().max(120).optional().or(z.literal("")),
  state: z.string().trim().max(120).optional().or(z.literal("")),
  holeCount: z.coerce.number().refine((n) => HOLE_COUNT_VALUES.includes(n as 9 | 18), {
    message: "Choose 9 or 18 holes",
  }),
});

export type CourseInput = z.infer<typeof courseSchema>;

export const TEE_CATEGORY_VALUES = ["male", "female", "unisex"] as const;

/**
 * A manually-entered tee set. Only `name` is required -- color, gender
 * category, rating and slope are all optional, same as a provider-imported
 * tee set can be missing them, since not every golfer entering a course
 * from memory will have a rating/slope card on hand.
 */
export const teeSetSchema = z.object({
  name: z.string().trim().min(1, "Enter a tee name").max(80),
  color: z
    .union([z.string().trim().max(40), z.literal(""), z.undefined()])
    .optional()
    .transform((v) => (v ? v : null)),
  category: z
    .union([z.enum(TEE_CATEGORY_VALUES), z.literal(""), z.undefined()])
    .optional()
    .transform((v) => (v ? v : null)),
  courseRating: z
    .union([z.coerce.number().min(50).max(100), z.literal(""), z.undefined(), z.null()])
    .optional()
    .transform((v) => (v === "" || v === undefined || v === null ? null : v)),
  slopeRating: z
    .union([z.coerce.number().int().min(1).max(200), z.literal(""), z.undefined(), z.null()])
    .optional()
    .transform((v) => (v === "" || v === undefined || v === null ? null : v)),
  totalYards: z
    .union([z.coerce.number().int().positive(), z.literal(""), z.undefined(), z.null()])
    .optional()
    .transform((v) => (v === "" || v === undefined || v === null ? null : v)),
});

export type TeeSetInput = z.infer<typeof teeSetSchema>;

/**
 * One hole's par/yardage/stroke index, as entered in the scorecard grid.
 * Par and hole number are required; yardage and stroke index are
 * optional since not every golfer entering a course from memory will
 * have both on hand.
 */
export const holeInputSchema = z.object({
  holeNumber: z.coerce.number().int().min(1).max(18),
  par: z.coerce.number().int().min(3, "Par must be 3-6").max(6, "Par must be 3-6"),
  yardage: z
    .union([z.coerce.number().int().positive(), z.literal(""), z.undefined(), z.null()])
    .optional()
    .transform((v) => (v === "" || v === undefined || v === null ? null : v)),
  strokeIndex: z
    .union([z.coerce.number().int().min(1).max(18), z.literal(""), z.undefined(), z.null()])
    .optional()
    .transform((v) => (v === "" || v === undefined || v === null ? null : v)),
});

export type HoleInput = z.infer<typeof holeInputSchema>;

/**
 * A full scorecard's worth of holes for one tee set, submitted together
 * as one bulk upsert (src/actions/courses.ts#saveHolesAction) so the
 * grid always saves as a single consistent set rather than one row at a
 * time. Stroke indexes, when entered for every hole, must each be used
 * exactly once (1-18, no repeats) — that's checked here rather than in
 * the database because it's a whole-tee-set property, not a
 * single-column constraint.
 */
export const holesFormSchema = z
  .array(holeInputSchema)
  .refine((holes) => new Set(holes.map((h) => h.holeNumber)).size === holes.length, {
    message: "Each hole number must appear once",
  })
  .refine(
    (holes) => {
      const indexes = holes.map((h) => h.strokeIndex).filter((v): v is number => v !== null);
      if (indexes.length === 0) return true;
      return new Set(indexes).size === indexes.length;
    },
    { message: "Each stroke index must be used only once" },
  );
