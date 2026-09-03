import { z } from "zod";

export const ROUND_HOLE_COUNT_VALUES = [9, 18] as const;

export const createRoundSchema = z.object({
  courseId: z.string().uuid("Choose a course"),
  name: z.string().trim().max(120).optional().or(z.literal("")),
  roundDate: z.string().min(1, "Choose a date"),
  startTime: z.string().optional().or(z.literal("")),
  holeCount: z.coerce
    .number()
    .refine((n) => ROUND_HOLE_COUNT_VALUES.includes(n as 9 | 18), { message: "Choose 9 or 18 holes" }),
});

export type CreateRoundInput = z.infer<typeof createRoundSchema>;

// Reuses the same bound (-10.0 to 54.0) as golf_profiles.handicap_index —
// a playing handicap for one round should never fall further outside
// that range than a profile handicap can.
const playingHandicapString = z
  .string()
  .trim()
  .regex(/^[+-]?\d{1,2}(\.\d)?$/, "Enter a handicap like 12.4 or +2.0")
  .refine((v) => {
    const n = Number(v);
    return n >= -10 && n <= 54;
  }, "Handicap must be between +10.0 and 54.0");

export const addRoundPlayerSchema = z.object({
  tripMemberId: z.string().uuid("Choose a golfer"),
  teeSetName: z.string().trim().max(80).optional().or(z.literal("")),
  playingHandicap: playingHandicapString.optional().or(z.literal("")),
});

export type AddRoundPlayerInput = z.infer<typeof addRoundPlayerSchema>;

export const updateRoundPlayerSchema = z.object({
  teeSetName: z.string().trim().max(80).optional().or(z.literal("")),
  playingHandicap: playingHandicapString.optional().or(z.literal("")),
  groupId: z.string().uuid().optional().or(z.literal("")),
});

export type UpdateRoundPlayerInput = z.infer<typeof updateRoundPlayerSchema>;

export const createRoundGroupSchema = z.object({
  label: z.string().trim().min(1, "Enter a group name").max(60),
  startingHole: z.coerce.number().int().min(1).max(18).default(1),
});

export type CreateRoundGroupInput = z.infer<typeof createRoundGroupSchema>;

export const updateRoundDetailsSchema = z.object({
  name: z.string().trim().max(120).optional().or(z.literal("")),
  roundDate: z.string().min(1, "Choose a date"),
  startTime: z.string().optional().or(z.literal("")),
});

export type UpdateRoundDetailsInput = z.infer<typeof updateRoundDetailsSchema>;
