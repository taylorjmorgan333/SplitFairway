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
    carryover: z.coerce.boolean().default(false),
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

/** Order in the submitted array becomes wolf_order 0-3 (see side_game_participants.wolf_order). */
export const createWolfGameSchema = z
  .object({
    name: z.string().trim().min(1, "Give this game a name").max(120),
    scoringMetric: z.enum(SCORING_METRIC_VALUES),
    playerIds: z.array(z.string().uuid()).length(4, "Wolf needs exactly four golfers, in hitting order"),
  })
  .merge(monetaryFields)
  .refine((data) => !data.isMonetary || (data.dollarValue != null && data.monetaryNoticeAccepted), {
    message: "Enter a dollar value and accept the notice to make this game monetary",
    path: ["dollarValue"],
  })
  .refine((data) => new Set(data.playerIds).size === data.playerIds.length, {
    message: "Each golfer can only fill one hitting-order spot",
    path: ["playerIds"],
  });

export type CreateWolfGameInput = z.infer<typeof createWolfGameSchema>;

export const createVegasGameSchema = z
  .object({
    name: z.string().trim().min(1, "Give this game a name").max(120),
    scoringMetric: z.enum(SCORING_METRIC_VALUES),
    side1PlayerIds: z.array(z.string().uuid()).length(2, "Vegas needs exactly two golfers per team"),
    side2PlayerIds: z.array(z.string().uuid()).length(2, "Vegas needs exactly two golfers per team"),
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
    { message: "A golfer can only play for one team", path: ["side2PlayerIds"] },
  );

export type CreateVegasGameInput = z.infer<typeof createVegasGameSchema>;

/** No scoringMetric field -- quota always scores gross vs. par (see quota.ts's doc comment for why net would double-count the handicap). */
export const createQuotaGameSchema = z
  .object({
    name: z.string().trim().min(1, "Give this game a name").max(120),
    playerIds: z.array(z.string().uuid()).min(2, "Quota needs at least two golfers"),
  })
  .merge(monetaryFields)
  .refine((data) => !data.isMonetary || (data.dollarValue != null && data.monetaryNoticeAccepted), {
    message: "Enter a dollar value and accept the notice to make this game monetary",
    path: ["dollarValue"],
  });

export type CreateQuotaGameInput = z.infer<typeof createQuotaGameSchema>;

export const createNinesGameSchema = z
  .object({
    name: z.string().trim().min(1, "Give this game a name").max(120),
    scoringMetric: z.enum(SCORING_METRIC_VALUES),
    playerIds: z.array(z.string().uuid()).length(3, "Nines needs exactly three golfers"),
  })
  .merge(monetaryFields)
  .refine((data) => !data.isMonetary || (data.dollarValue != null && data.monetaryNoticeAccepted), {
    message: "Enter a dollar value and accept the notice to make this game monetary",
    path: ["dollarValue"],
  });

export type CreateNinesGameInput = z.infer<typeof createNinesGameSchema>;

export const createTwosGameSchema = z
  .object({
    name: z.string().trim().min(1, "Give this game a name").max(120),
    scoringMetric: z.enum(SCORING_METRIC_VALUES),
    playerIds: z.array(z.string().uuid()).min(2, "Twos club needs at least two golfers"),
  })
  .merge(monetaryFields)
  .refine((data) => !data.isMonetary || (data.dollarValue != null && data.monetaryNoticeAccepted), {
    message: "Enter a dollar value and accept the notice to make this game monetary",
    path: ["dollarValue"],
  });

export type CreateTwosGameInput = z.infer<typeof createTwosGameSchema>;

/**
 * Batch 1 of the Squabbit-list expansion (games/game-type-picker.tsx):
 * formats that are pure aggregation formulas over scores already
 * recorded via hole_scores -- no new per-hole data entry, no schema
 * changes beyond new side_game_type enum values. Individual formats
 * (match play, stroke play, Stableford) reuse the side-less or
 * exactly-two-sides shapes already established above; team formats
 * reuse the same side1/side2 shape as Nassau/Vegas, just with looser or
 * tighter size rules per format (see each schema's own comment).
 */

export const createMatchPlayGameSchema = z
  .object({
    name: z.string().trim().min(1, "Give this game a name").max(120),
    scoringMetric: z.enum(SCORING_METRIC_VALUES),
    side1PlayerIds: z.array(z.string().uuid()).length(1, "Match play is one golfer per side"),
    side2PlayerIds: z.array(z.string().uuid()).length(1, "Match play is one golfer per side"),
  })
  .merge(monetaryFields)
  .refine((data) => !data.isMonetary || (data.dollarValue != null && data.monetaryNoticeAccepted), {
    message: "Enter a dollar value and accept the notice to make this game monetary",
    path: ["dollarValue"],
  })
  .refine((data) => data.side1PlayerIds[0] !== data.side2PlayerIds[0], {
    message: "Pick two different golfers",
    path: ["side2PlayerIds"],
  });

export type CreateMatchPlayGameInput = z.infer<typeof createMatchPlayGameSchema>;

export const createStrokePlayGameSchema = z
  .object({
    name: z.string().trim().min(1, "Give this game a name").max(120),
    scoringMetric: z.enum(SCORING_METRIC_VALUES),
    playerIds: z.array(z.string().uuid()).min(2, "Stroke play needs at least two golfers"),
  })
  .merge(monetaryFields)
  .refine((data) => !data.isMonetary || (data.dollarValue != null && data.monetaryNoticeAccepted), {
    message: "Enter a dollar value and accept the notice to make this game monetary",
    path: ["dollarValue"],
  });

export type CreateStrokePlayGameInput = z.infer<typeof createStrokePlayGameSchema>;

/** No scoringMetric field -- Stableford points are always computed against net score (scoring.ts#computePlayerStableford), the same reasoning quota.ts uses for staying gross-only. */
export const createStablefordGameSchema = z
  .object({
    name: z.string().trim().min(1, "Give this game a name").max(120),
    playerIds: z.array(z.string().uuid()).min(2, "Stableford needs at least two golfers"),
  })
  .merge(monetaryFields)
  .refine((data) => !data.isMonetary || (data.dollarValue != null && data.monetaryNoticeAccepted), {
    message: "Enter a dollar value and accept the notice to make this game monetary",
    path: ["dollarValue"],
  });

export type CreateStablefordGameInput = z.infer<typeof createStablefordGameSchema>;

function noOverlapRefine<T extends { side1PlayerIds: string[]; side2PlayerIds: string[] }>(data: T): boolean {
  return data.side1PlayerIds.filter((id) => data.side2PlayerIds.includes(id)).length === 0;
}

const flexibleSidesShape = {
  side1PlayerIds: z.array(z.string().uuid()).min(1, "Add at least one golfer to each side"),
  side2PlayerIds: z.array(z.string().uuid()).min(1, "Add at least one golfer to each side"),
};

export const createBestBallGameSchema = z
  .object({
    name: z.string().trim().min(1, "Give this game a name").max(120),
    scoringMetric: z.enum(SCORING_METRIC_VALUES),
    ...flexibleSidesShape,
  })
  .merge(monetaryFields)
  .refine((data) => !data.isMonetary || (data.dollarValue != null && data.monetaryNoticeAccepted), {
    message: "Enter a dollar value and accept the notice to make this game monetary",
    path: ["dollarValue"],
  })
  .refine(noOverlapRefine, { message: "A golfer can only play for one side", path: ["side2PlayerIds"] });

export type CreateBestBallGameInput = z.infer<typeof createBestBallGameSchema>;

export const createWorstBallGameSchema = z
  .object({
    name: z.string().trim().min(1, "Give this game a name").max(120),
    scoringMetric: z.enum(SCORING_METRIC_VALUES),
    ...flexibleSidesShape,
  })
  .merge(monetaryFields)
  .refine((data) => !data.isMonetary || (data.dollarValue != null && data.monetaryNoticeAccepted), {
    message: "Enter a dollar value and accept the notice to make this game monetary",
    path: ["dollarValue"],
  })
  .refine(noOverlapRefine, { message: "A golfer can only play for one side", path: ["side2PlayerIds"] });

export type CreateWorstBallGameInput = z.infer<typeof createWorstBallGameSchema>;

export const createShambleGameSchema = z
  .object({
    name: z.string().trim().min(1, "Give this game a name").max(120),
    scoringMetric: z.enum(SCORING_METRIC_VALUES),
    ...flexibleSidesShape,
  })
  .merge(monetaryFields)
  .refine((data) => !data.isMonetary || (data.dollarValue != null && data.monetaryNoticeAccepted), {
    message: "Enter a dollar value and accept the notice to make this game monetary",
    path: ["dollarValue"],
  })
  .refine(noOverlapRefine, { message: "A golfer can only play for one side", path: ["side2PlayerIds"] });

export type CreateShambleGameInput = z.infer<typeof createShambleGameSchema>;

export const createTeamAverageGameSchema = z
  .object({
    name: z.string().trim().min(1, "Give this game a name").max(120),
    scoringMetric: z.enum(SCORING_METRIC_VALUES),
    ...flexibleSidesShape,
  })
  .merge(monetaryFields)
  .refine((data) => !data.isMonetary || (data.dollarValue != null && data.monetaryNoticeAccepted), {
    message: "Enter a dollar value and accept the notice to make this game monetary",
    path: ["dollarValue"],
  })
  .refine(noOverlapRefine, { message: "A golfer can only play for one side", path: ["side2PlayerIds"] });

export type CreateTeamAverageGameInput = z.infer<typeof createTeamAverageGameSchema>;

/** Side 1 is always the single designated Lone Ranger; side 2 is the rest of the group they're up against (best-ball of two or more). */
export const createLoneRangerGameSchema = z
  .object({
    name: z.string().trim().min(1, "Give this game a name").max(120),
    scoringMetric: z.enum(SCORING_METRIC_VALUES),
    side1PlayerIds: z.array(z.string().uuid()).length(1, "Pick exactly one golfer as the Lone Ranger"),
    side2PlayerIds: z.array(z.string().uuid()).min(2, "Needs at least two other golfers to play against"),
  })
  .merge(monetaryFields)
  .refine((data) => !data.isMonetary || (data.dollarValue != null && data.monetaryNoticeAccepted), {
    message: "Enter a dollar value and accept the notice to make this game monetary",
    path: ["dollarValue"],
  })
  .refine(noOverlapRefine, { message: "A golfer can only play for one side", path: ["side2PlayerIds"] });

export type CreateLoneRangerGameInput = z.infer<typeof createLoneRangerGameSchema>;

/** Each side needs at least two golfers so the rotating best-N-count-of formula (team-formats.ts#chaChaChaFormula) has more than one score to choose from. */
export const createChaChaChaGameSchema = z
  .object({
    name: z.string().trim().min(1, "Give this game a name").max(120),
    scoringMetric: z.enum(SCORING_METRIC_VALUES),
    side1PlayerIds: z.array(z.string().uuid()).min(2, "Needs at least two golfers per side"),
    side2PlayerIds: z.array(z.string().uuid()).min(2, "Needs at least two golfers per side"),
  })
  .merge(monetaryFields)
  .refine((data) => !data.isMonetary || (data.dollarValue != null && data.monetaryNoticeAccepted), {
    message: "Enter a dollar value and accept the notice to make this game monetary",
    path: ["dollarValue"],
  })
  .refine(noOverlapRefine, { message: "A golfer can only play for one side", path: ["side2PlayerIds"] });

export type CreateChaChaChaGameInput = z.infer<typeof createChaChaChaGameSchema>;

/** No scoringMetric field -- One Gross One Net's formula always combines both a gross-best and a net-best per hole (team-formats.ts#computeOneGrossOneNet), so there's no single metric to choose. */
export const createOneGrossOneNetGameSchema = z
  .object({
    name: z.string().trim().min(1, "Give this game a name").max(120),
    ...flexibleSidesShape,
  })
  .merge(monetaryFields)
  .refine((data) => !data.isMonetary || (data.dollarValue != null && data.monetaryNoticeAccepted), {
    message: "Enter a dollar value and accept the notice to make this game monetary",
    path: ["dollarValue"],
  })
  .refine(noOverlapRefine, { message: "A golfer can only play for one side", path: ["side2PlayerIds"] });

export type CreateOneGrossOneNetGameInput = z.infer<typeof createOneGrossOneNetGameSchema>;

export const createLowBallHighBallGameSchema = z
  .object({
    name: z.string().trim().min(1, "Give this game a name").max(120),
    scoringMetric: z.enum(SCORING_METRIC_VALUES),
    side1PlayerIds: z.array(z.string().uuid()).length(2, "Needs exactly two golfers per side"),
    side2PlayerIds: z.array(z.string().uuid()).length(2, "Needs exactly two golfers per side"),
  })
  .merge(monetaryFields)
  .refine((data) => !data.isMonetary || (data.dollarValue != null && data.monetaryNoticeAccepted), {
    message: "Enter a dollar value and accept the notice to make this game monetary",
    path: ["dollarValue"],
  })
  .refine(noOverlapRefine, { message: "A golfer can only play for one side", path: ["side2PlayerIds"] });

export type CreateLowBallHighBallGameInput = z.infer<typeof createLowBallHighBallGameSchema>;

export const createLowBallLowTotalGameSchema = z
  .object({
    name: z.string().trim().min(1, "Give this game a name").max(120),
    scoringMetric: z.enum(SCORING_METRIC_VALUES),
    ...flexibleSidesShape,
  })
  .merge(monetaryFields)
  .refine((data) => !data.isMonetary || (data.dollarValue != null && data.monetaryNoticeAccepted), {
    message: "Enter a dollar value and accept the notice to make this game monetary",
    path: ["dollarValue"],
  })
  .refine(noOverlapRefine, { message: "A golfer can only play for one side", path: ["side2PlayerIds"] });

export type CreateLowBallLowTotalGameInput = z.infer<typeof createLowBallLowTotalGameSchema>;

/** Exactly two per side so each side has an unambiguous low-handicap and high-handicap player to pair off (team-formats.ts#computeLowHandicapHighHandicap). */
export const createLowHandicapHighHandicapGameSchema = z
  .object({
    name: z.string().trim().min(1, "Give this game a name").max(120),
    scoringMetric: z.enum(SCORING_METRIC_VALUES),
    side1PlayerIds: z.array(z.string().uuid()).length(2, "Needs exactly two golfers per side"),
    side2PlayerIds: z.array(z.string().uuid()).length(2, "Needs exactly two golfers per side"),
  })
  .merge(monetaryFields)
  .refine((data) => !data.isMonetary || (data.dollarValue != null && data.monetaryNoticeAccepted), {
    message: "Enter a dollar value and accept the notice to make this game monetary",
    path: ["dollarValue"],
  })
  .refine(noOverlapRefine, { message: "A golfer can only play for one side", path: ["side2PlayerIds"] });

export type CreateLowHandicapHighHandicapGameInput = z.infer<typeof createLowHandicapHighHandicapGameSchema>;

export const wolfPickSchema = z
  .object({
    holeNumber: z.coerce.number().int().min(1).max(18),
    partnerRoundPlayerId: z
      .union([z.string().uuid(), z.literal(""), z.undefined()])
      .optional()
      .transform((v) => (v ? v : null)),
    isLoneWolf: z.coerce.boolean().default(false),
  })
  .refine((data) => data.isLoneWolf || data.partnerRoundPlayerId != null, {
    message: "Pick a partner or go lone wolf",
    path: ["partnerRoundPlayerId"],
  });

export type WolfPickFormInput = z.infer<typeof wolfPickSchema>;
