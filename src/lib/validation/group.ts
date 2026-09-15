import { z } from "zod";

// Mirrors public.side_game_type (see database.types.ts's generated
// Constants.public.Enums.side_game_type) -- kept as a plain list here
// rather than re-exported from side-game.ts because that file has no
// single exported array of every value, only per-format schemas.
export const GROUP_PRESET_GAME_TYPES = [
  "nassau",
  "skins",
  "wolf",
  "vegas",
  "quota",
  "nines",
  "twos",
  "match_play",
  "stroke_play",
  "stableford",
  "best_ball",
  "worst_ball",
  "shamble",
  "team_average",
  "low_ball_high_ball",
  "low_ball_low_total",
  "low_handicap_high_handicap",
  "one_gross_one_net",
  "lone_ranger",
  "cha_cha_cha",
  "custom",
] as const;

export const createGroupSchema = z.object({
  name: z.string().trim().min(1, "Group name is required").max(120),
  description: z.string().trim().max(500).optional().or(z.literal("")),
});
export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export const updateGroupSchema = createGroupSchema;
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;

// Adding a saved golfer to a group -- deliberately close to
// addMemberManuallySchema (trip.ts): a name is the only thing actually
// required, since the whole point of a saved group is being able to
// add "the regular Saturday guys" without an email address for anyone
// who won't have an account.
export const addGroupMemberSchema = z.object({
  displayName: z.string().trim().min(1, "Name is required").max(120),
  email: z
    .union([z.string().trim().email("Enter a valid email address"), z.literal("")])
    .optional(),
  defaultHandicapIndex: z
    .union([z.coerce.number().min(-10).max(54), z.literal("")])
    .optional(),
  preferredTeeName: z.string().trim().max(60).optional().or(z.literal("")),
});
export type AddGroupMemberInput = z.infer<typeof addGroupMemberSchema>;

export const createGroupGamePresetSchema = z.object({
  name: z.string().trim().min(1, "Give this preset a name").max(120),
  sideGameType: z.enum(GROUP_PRESET_GAME_TYPES),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});
export type CreateGroupGamePresetInput = z.infer<typeof createGroupGamePresetSchema>;
