import { z } from "zod";

/**
 * Validates raw GolfCourseAPI JSON before anything else in this app
 * touches it. Provider data is untrusted input, same as a user-submitted
 * form — a network provider can send an unexpected shape, a null where a
 * number was expected, or (if GolfCourseAPI ships a bug, or a future
 * response version) a field this app has never seen. Every numeric field
 * is `nullable()`, never defaulted to 0 — a missing course rating must
 * stay "unknown", not silently become a rating of zero, which would be a
 * real (wrong) value. Hole count is deliberately NOT constrained to 9/18
 * here (a multi-course facility's tee box could theoretically be
 * something else) — that constraint is enforced later, deliberately, in
 * course-import-mapping.ts, where a course with an unusable hole count is
 * rejected with a clear error rather than silently coerced.
 */

const holeSchema = z.object({
  par: z.number().int(),
  yardage: z.number().int().nullable().optional().transform((v) => v ?? null),
  handicap: z.number().int().nullable().optional().transform((v) => v ?? null),
});

const teeBoxSchema = z.object({
  tee_name: z.string().trim().min(1),
  course_rating: z.number().nullable().optional().transform((v) => v ?? null),
  slope_rating: z.number().int().nullable().optional().transform((v) => v ?? null),
  total_yards: z.number().int().nullable().optional().transform((v) => v ?? null),
  total_meters: z.number().int().nullable().optional().transform((v) => v ?? null),
  number_of_holes: z.number().int().nullable().optional().transform((v) => v ?? null),
  par_total: z.number().int().nullable().optional().transform((v) => v ?? null),
  holes: z.array(holeSchema).default([]),
});

const locationSchema = z
  .object({
    address: z.string().trim().nullable().optional().transform((v) => v || null),
    city: z.string().trim().nullable().optional().transform((v) => v || null),
    state: z.string().trim().nullable().optional().transform((v) => v || null),
    country: z.string().trim().nullable().optional().transform((v) => v || null),
  })
  .nullable()
  .optional();

/** Search-result row: tees is a count, never full tee-box data (see golfcourseapi.ts). */
export const golfCourseApiSearchResultSchema = z.object({
  id: z.string().trim().min(1),
  club_name: z.string().trim().min(1),
  course_name: z.string().trim().min(1),
  scorecard_url: z.string().trim().nullable().optional().transform((v) => v || null),
  location: locationSchema,
  tees: z
    .object({
      male: z.number().int().nonnegative().default(0),
      female: z.number().int().nonnegative().default(0),
    })
    .default({ male: 0, female: 0 }),
});

export const golfCourseApiSearchResponseSchema = z.object({
  courses: z.array(golfCourseApiSearchResultSchema).default([]),
});

/** Full course detail: real tee-box arrays with hole-by-hole data. */
export const golfCourseApiCourseDetailSchema = z.object({
  id: z.string().trim().min(1),
  club_name: z.string().trim().min(1),
  course_name: z.string().trim().min(1),
  scorecard_url: z.string().trim().nullable().optional().transform((v) => v || null),
  location: locationSchema,
  tees: z
    .object({
      male: z.array(teeBoxSchema).default([]),
      female: z.array(teeBoxSchema).default([]),
    })
    .default({ male: [], female: [] }),
});

export const golfCourseApiCourseDetailResponseSchema = z.object({
  course: golfCourseApiCourseDetailSchema,
});

export type ValidatedGolfCourseApiSearchResult = z.infer<typeof golfCourseApiSearchResultSchema>;
export type ValidatedGolfCourseApiCourseDetail = z.infer<typeof golfCourseApiCourseDetailSchema>;
