import { z } from "zod";

export const DOMINANT_HAND_VALUES = ["right", "left"] as const;

// WHS handicap indexes run roughly -10.0 (a strong "plus" handicap) to
// 54.0 — matches the golf_profiles_handicap_range check constraint in
// supabase/migrations/20260903000000_golf_profiles.sql. Kept in sync by
// hand since this is a sanity bound, not generated from the DB schema.
const handicapIndexString = z
  .string()
  .trim()
  .regex(/^[+-]?\d{1,2}(\.\d)?$/, "Enter a handicap like 12.4 or +2.0")
  .refine((v) => {
    const n = Number(v);
    return n >= -10 && n <= 54;
  }, "Handicap must be between +10.0 and 54.0");

/**
 * Manual golf-profile entry — every field the golfer can type in
 * directly (Golf Profile section, "Enter information manually"). GHIN
 * screenshot import (phase 3) reuses this same schema for the fields it
 * extracts, since every extracted value still needs to pass through
 * this same validation before it can be saved.
 */
export const golfProfileSchema = z.object({
  ghinNumber: z
    .string()
    .trim()
    .regex(/^\d{1,10}$/, "GHIN number should be digits only")
    .optional()
    .or(z.literal("")),
  handicapIndex: handicapIndexString.optional().or(z.literal("")),
  handicapRevisionDate: z.string().optional().or(z.literal("")),
  homeClub: z.string().trim().max(160).optional().or(z.literal("")),
  golfAssociation: z.string().trim().max(160).optional().or(z.literal("")),
  preferredTee: z.string().trim().max(80).optional().or(z.literal("")),
  dominantHand: z.enum(DOMINANT_HAND_VALUES).optional().or(z.literal("")),
});

export type GolfProfileInput = z.infer<typeof golfProfileSchema>;
