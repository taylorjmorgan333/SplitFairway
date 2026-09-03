import { z } from "zod";

export const SCORING_METRIC_VALUES = ["gross", "net"] as const;
export const SEGMENT_VALUES = ["front", "back", "overall"] as const;

const monetaryFields = z.object({
  isMonetary: z.coerce.boolean().default(false),
  dollarValue: z
    .union([z.coerce.number().positive(), z.literal(""), z.undefined(), z.null()])
    .optional()
    .transform((v) => (v === "" || v === undefined || v === null ? null : v)),
  monetaryNoticeAccepted: z.coerce.boolean().default(false),
});

export const createNassauGameSchema = z
  .object({
    name: z.string().trim().min(1, "Give this game a name").max(120),
    scoringMetric: z.enum(SCORING_METRIC_VALUES),
    side1PlayerIds: z.array(z.string().uuid()).min(1, "Add at least one golfer to each side"),
    side2PlayerIds: z.array(z.string().uuid()).min(1, "Add at least one golfer to each side"),
  })
  .merge(monetaryFields)
  .refine((data) => !data.isMonetary || (data.dollarValue != null && data.monetaryNoticeAccepted), {
    message: "Enter a dollar value and accept the notice to make this game monetary",
    path: ["dollarValue"],
  })
  .refine(
    (data) => {
      const overlap = data.side1PlayerIds.filter((id) => data.side2PlayerIds.includes(id));
      return overlap.length === 0;
    },
    { message: "A golfer can only play for one side", path: ["side2PlayerIds"] },
  );

export type CreateNassauGameInput = z.infer<typeof createNassauGameSchema>;

export const createSkinsGameSchema = z
  .object({
    name: z.string().trim().min(1, "Give this game a name").max(120),
    scoringMetric: z.enum(SCORING_METRIC_VALUES),
    carryover: z.coerce.boolean().default(true),
    playerIds: z.array(z.string().uuid()).min(2, "Skins needs at least two golfers"),
  })
  .merge(monetaryFields)
  .refine((data) => !data.isMonetary || (data.dollarValue != null && data.monetaryNoticeAccepted), {
    message: "Enter a dollar value and accept the notice to make this game monetary",
    path: ["dollarValue"],
  });

export type CreateSkinsGameInput = z.infer<typeof createSkinsGameSchema>;

export const createPressSchema = z.object({
  segment: z.enum(SEGMENT_VALUES),
  startingHole: z.coerce.number().int().min(1).max(18),
});

export type CreatePressInput = z.infer<typeof createPressSchema>;
