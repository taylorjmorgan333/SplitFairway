import { z } from "zod";

/**
 * The six counters every trip starts with when a captain turns on The
 * 19th Hole. `key` is the stable slug stored on nineteenth_hole_counters
 * and referenced by every activity row -- it never changes even if the
 * captain renames the counter's label (e.g. "Drinks" -> "Beers" keeps
 * key "drinks"), so historical activity always still resolves correctly.
 */
export const DEFAULT_NINETEENTH_HOLE_COUNTERS = [
  { key: "drinks", label: "Drinks" },
  { key: "birdies", label: "Birdies" },
  { key: "three_putts", label: "Three-Putts" },
  { key: "lost_balls", label: "Lost Balls" },
  { key: "water_balls", label: "Water Balls" },
  { key: "mulligans", label: "Mulligans" },
] as const;

/** The only default counter framed as a positive golf achievement (see
 * Standings copy) rather than a good-natured jab -- birdies are
 * something to brag about, not laugh off. */
export const POSITIVE_ACHIEVEMENT_KEYS: ReadonlySet<string> = new Set(["birdies"]);

export const WHO_CAN_RECORD_VALUES = ["everyone", "captains_only"] as const;
export type WhoCanRecord = (typeof WHO_CAN_RECORD_VALUES)[number];

export const counterLabelSchema = z
  .string()
  .trim()
  .min(1, "Give this counter a name")
  .max(40, "Keep it under 40 characters");

export const whoCanRecordSchema = z.enum(WHO_CAN_RECORD_VALUES);

export const recordActivitySchema = z.object({
  tripMemberId: z.string().uuid(),
  counterId: z.string().uuid(),
  roundId: z.string().uuid().optional().or(z.literal("")),
  quantity: z.union([z.literal(1), z.literal(-1)]),
});

export type RecordActivityInput = z.infer<typeof recordActivitySchema>;

/**
 * Turns a captain-entered label into a stable, URL/DB-safe slug for a
 * new custom counter's `key` -- lowercased, non-alphanumerics collapsed
 * to underscores, trimmed of leading/trailing underscores, and capped
 * at a sane length. The caller is responsible for de-duplicating
 * against a trip's existing keys (see addCustomCounterAction).
 */
export function slugifyCounterKey(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return slug || "counter";
}
