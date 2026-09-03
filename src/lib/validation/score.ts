import { z } from "zod";

// A gross score of 1 is a hole-in-one; 20 is a generous ceiling for a
// pick-up/max score on a par 3-6 hole. null clears an entered score.
export const grossStrokesSchema = z
  .number()
  .int()
  .min(1)
  .max(20)
  .nullable();

export const holeNumberSchema = z.number().int().min(1).max(18);
