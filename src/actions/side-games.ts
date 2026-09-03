"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  createNassauGameSchema,
  createSkinsGameSchema,
  createPressSchema,
  createWolfGameSchema,
  createVegasGameSchema,
  createQuotaGameSchema,
  createNinesGameSchema,
  createTwosGameSchema,
  wolfPickSchema,
} from "@/lib/validation/side-game";
import type { ActionState } from "@/actions/auth";

/**
 * Creates a Nassau game: one side_games row plus one side_game_participants
 * row per golfer, tagged with which side (1 or 2) they play for.
 * MONETARY_GAME_VALUES_ENABLED gates whether the create form even shows
 * the dollar-value toggle (src/lib/config.ts, checked on the page); this
 * action still enforces the same monetary-fields-consistent shape the
 * database itself requires (supabase/migrations/20260903080000_side_games.sql)
 * -- a request that sets isMonetary without accepting the notice fails
 * validation before it ever reaches the insert.
 */
export async function createNassauGameAction(
  roundId: string,
  tripId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createNassauGameSchema.safeParse({
    name: formData.get("name"),
    scoringMetric: formData.get("scoringMetric"),
    side1PlayerIds: formData.getAll("side1PlayerIds"),
    side2PlayerIds: formData.getAll("side2PlayerIds"),
    isMonetary: formData.get("isMonetary") === "on",
    dollarValue: formData.get("dollarValue"),
    monetaryNoticeAccepted: formData.get("monetaryNoticeAccepted") === "on",
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: "error", message: "You need to be signed in." };
  }

  const { data: game, error: gameError } = await supabase
    .from("side_games")
    .insert({
      round_id: roundId,
      game_type: "nassau",
      name: parsed.data.name,
      scoring_metric: parsed.data.scoringMetric,
      is_monetary: parsed.data.isMonetary,
      dollar_value: parsed.data.isMonetary ? parsed.data.dollarValue : null,
      monetary_accepted_by: parsed.data.isMonetary ? user.id : null,
      monetary_accepted_at: parsed.data.isMonetary ? new Date().toISOString() : null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (gameError || !game) {
    return { status: "error", message: "Couldn't create this game — make sure you're the trip captain." };
  }

  const participants = [
    ...parsed.data.side1PlayerIds.map((id) => ({ side_game_id: game.id, round_player_id: id, side: 1 })),
    ...parsed.data.side2PlayerIds.map((id) => ({ side_game_id: game.id, round_player_id: id, side: 2 })),
  ];
  const { error: participantsError } = await supabase.from("side_game_participants").insert(participants);

  if (participantsError) {
    // Roll back the otherwise-orphaned game row rather than leaving a
    // Nassau game with no sides on it.
    await supabase.from("side_games").delete().eq("id", game.id);
    return { status: "error", message: "Couldn't add golfers to this game. Please try again." };
  }

  revalidatePath(`/trips/${tripId}/rounds/${roundId}/games`);
  return { status: "success", message: "Nassau game created." };
}

/** Creates a skins game: one side_games row plus one participant row per golfer, with no side. */
export async function createSkinsGameAction(
  roundId: string,
  tripId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createSkinsGameSchema.safeParse({
    name: formData.get("name"),
    scoringMetric: formData.get("scoringMetric"),
    carryover: formData.get("carryover") === "on",
    playerIds: formData.getAll("playerIds"),
    isMonetary: formData.get("isMonetary") === "on",
    dollarValue: formData.get("dollarValue"),
    monetaryNoticeAccepted: formData.get("monetaryNoticeAccepted") === "on",
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: "error", message: "You need to be signed in." };
  }

  const { data: game, error: gameError } = await supabase
    .from("side_games")
    .insert({
      round_id: roundId,
      game_type: "skins",
      name: parsed.data.name,
      scoring_metric: parsed.data.scoringMetric,
      carryover: parsed.data.carryover,
      is_monetary: parsed.data.isMonetary,
      dollar_value: parsed.data.isMonetary ? parsed.data.dollarValue : null,
      monetary_accepted_by: parsed.data.isMonetary ? user.id : null,
      monetary_accepted_at: parsed.data.isMonetary ? new Date().toISOString() : null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (gameError || !game) {
    return { status: "error", message: "Couldn't create this game — make sure you're the trip captain." };
  }

  const { error: participantsError } = await supabase.from("side_game_participants").insert(
    parsed.data.playerIds.map((id) => ({ side_game_id: game.id, round_player_id: id, side: null })),
  );

  if (participantsError) {
    await supabase.from("side_games").delete().eq("id", game.id);
    return { status: "error", message: "Couldn't add golfers to this game. Please try again." };
  }

  revalidatePath(`/trips/${tripId}/rounds/${roundId}/games`);
  return { status: "success", message: "Skins game created." };
}

export async function deleteSideGameAction(roundId: string, tripId: string, gameId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("side_games").delete().eq("id", gameId);
  if (error) {
    throw new Error("Couldn't delete this game.");
  }
  revalidatePath(`/trips/${tripId}/rounds/${roundId}/games`);
}

/**
 * Starts a press on a Nassau game -- a new sub-match from startingHole
 * to the end of its segment. Called directly from the games page
 * (useTransition, not a <form>/useActionState) since it's a quick,
 * single-button action from whichever golfer wants to press.
 */
export async function addPressAction(
  roundId: string,
  tripId: string,
  gameId: string,
  segment: "front" | "back" | "overall",
  startingHole: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = createPressSchema.safeParse({ segment, startingHole });
  if (!parsed.success) {
    return { ok: false, error: "Invalid press." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You need to be signed in." };
  }

  const { error } = await supabase.from("side_game_presses").insert({
    side_game_id: gameId,
    segment: parsed.data.segment,
    starting_hole: parsed.data.startingHole,
    created_by: user.id,
  });

  if (error) {
    return { ok: false, error: "Couldn't start that press." };
  }

  revalidatePath(`/trips/${tripId}/rounds/${roundId}/games`);
  return { ok: true };
}

/**
 * Creates a wolf game: one side_games row plus one participant per
 * golfer, tagged with wolf_order = their position in the submitted
 * playerIds array (0-3) -- the create form collects players in hitting
 * order via four ordered pickers, so array position IS the order.
 */
export async function createWolfGameAction(
  roundId: string,
  tripId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createWolfGameSchema.safeParse({
    name: formData.get("name"),
    scoringMetric: formData.get("scoringMetric"),
    playerIds: formData.getAll("playerIds"),
    isMonetary: formData.get("isMonetary") === "on",
    dollarValue: formData.get("dollarValue"),
    monetaryNoticeAccepted: formData.get("monetaryNoticeAccepted") === "on",
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: "error", message: "You need to be signed in." };
  }

  const { data: game, error: gameError } = await supabase
    .from("side_games")
    .insert({
      round_id: roundId,
      game_type: "wolf",
      name: parsed.data.name,
      scoring_metric: parsed.data.scoringMetric,
      is_monetary: parsed.data.isMonetary,
      dollar_value: parsed.data.isMonetary ? parsed.data.dollarValue : null,
      monetary_accepted_by: parsed.data.isMonetary ? user.id : null,
      monetary_accepted_at: parsed.data.isMonetary ? new Date().toISOString() : null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (gameError || !game) {
    return { status: "error", message: "Couldn't create this game — make sure you're the trip captain." };
  }

  const participants = parsed.data.playerIds.map((id, index) => ({
    side_game_id: game.id,
    round_player_id: id,
    side: null,
    wolf_order: index,
  }));
  const { error: participantsError } = await supabase.from("side_game_participants").insert(participants);

  if (participantsError) {
    await supabase.from("side_games").delete().eq("id", game.id);
    return { status: "error", message: "Couldn't add golfers to this game. Please try again." };
  }

  revalidatePath(`/trips/${tripId}/rounds/${roundId}/games`);
  return { status: "success", message: "Wolf game created." };
}

/** Creates a vegas game: one side_games row plus two 2-player teams, reusing the side column exactly like nassau. */
export async function createVegasGameAction(
  roundId: string,
  tripId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createVegasGameSchema.safeParse({
    name: formData.get("name"),
    scoringMetric: formData.get("scoringMetric"),
    side1PlayerIds: formData.getAll("side1PlayerIds"),
    side2PlayerIds: formData.getAll("side2PlayerIds"),
    isMonetary: formData.get("isMonetary") === "on",
    dollarValue: formData.get("dollarValue"),
    monetaryNoticeAccepted: formData.get("monetaryNoticeAccepted") === "on",
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: "error", message: "You need to be signed in." };
  }

  const { data: game, error: gameError } = await supabase
    .from("side_games")
    .insert({
      round_id: roundId,
      game_type: "vegas",
      name: parsed.data.name,
      scoring_metric: parsed.data.scoringMetric,
      is_monetary: parsed.data.isMonetary,
      dollar_value: parsed.data.isMonetary ? parsed.data.dollarValue : null,
      monetary_accepted_by: parsed.data.isMonetary ? user.id : null,
      monetary_accepted_at: parsed.data.isMonetary ? new Date().toISOString() : null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (gameError || !game) {
    return { status: "error", message: "Couldn't create this game — make sure you're the trip captain." };
  }

  const participants = [
    ...parsed.data.side1PlayerIds.map((id) => ({ side_game_id: game.id, round_player_id: id, side: 1 })),
    ...parsed.data.side2PlayerIds.map((id) => ({ side_game_id: game.id, round_player_id: id, side: 2 })),
  ];
  const { error: participantsError } = await supabase.from("side_game_participants").insert(participants);

  if (participantsError) {
    await supabase.from("side_games").delete().eq("id", game.id);
    return { status: "error", message: "Couldn't add golfers to this game. Please try again." };
  }

  revalidatePath(`/trips/${tripId}/rounds/${roundId}/games`);
  return { status: "success", message: "Vegas game created." };
}

/** Creates a quota game. scoring_metric is always stored as "gross" -- quota.ts always scores gross vs. par, so there's no metric choice in this create form. */
export async function createQuotaGameAction(
  roundId: string,
  tripId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createQuotaGameSchema.safeParse({
    name: formData.get("name"),
    playerIds: formData.getAll("playerIds"),
    isMonetary: formData.get("isMonetary") === "on",
    dollarValue: formData.get("dollarValue"),
    monetaryNoticeAccepted: formData.get("monetaryNoticeAccepted") === "on",
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: "error", message: "You need to be signed in." };
  }

  const { data: game, error: gameError } = await supabase
    .from("side_games")
    .insert({
      round_id: roundId,
      game_type: "quota",
      name: parsed.data.name,
      scoring_metric: "gross",
      is_monetary: parsed.data.isMonetary,
      dollar_value: parsed.data.isMonetary ? parsed.data.dollarValue : null,
      monetary_accepted_by: parsed.data.isMonetary ? user.id : null,
      monetary_accepted_at: parsed.data.isMonetary ? new Date().toISOString() : null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (gameError || !game) {
    return { status: "error", message: "Couldn't create this game — make sure you're the trip captain." };
  }

  const { error: participantsError } = await supabase.from("side_game_participants").insert(
    parsed.data.playerIds.map((id) => ({ side_game_id: game.id, round_player_id: id, side: null })),
  );

  if (participantsError) {
    await supabase.from("side_games").delete().eq("id", game.id);
    return { status: "error", message: "Couldn't add golfers to this game. Please try again." };
  }

  revalidatePath(`/trips/${tripId}/rounds/${roundId}/games`);
  return { status: "success", message: "Quota game created." };
}

/** Creates a nines game: exactly 3 golfers, no sides. */
export async function createNinesGameAction(
  roundId: string,
  tripId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createNinesGameSchema.safeParse({
    name: formData.get("name"),
    scoringMetric: formData.get("scoringMetric"),
    playerIds: formData.getAll("playerIds"),
    isMonetary: formData.get("isMonetary") === "on",
    dollarValue: formData.get("dollarValue"),
    monetaryNoticeAccepted: formData.get("monetaryNoticeAccepted") === "on",
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: "error", message: "You need to be signed in." };
  }

  const { data: game, error: gameError } = await supabase
    .from("side_games")
    .insert({
      round_id: roundId,
      game_type: "nines",
      name: parsed.data.name,
      scoring_metric: parsed.data.scoringMetric,
      is_monetary: parsed.data.isMonetary,
      dollar_value: parsed.data.isMonetary ? parsed.data.dollarValue : null,
      monetary_accepted_by: parsed.data.isMonetary ? user.id : null,
      monetary_accepted_at: parsed.data.isMonetary ? new Date().toISOString() : null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (gameError || !game) {
    return { status: "error", message: "Couldn't create this game — make sure you're the trip captain." };
  }

  const { error: participantsError } = await supabase.from("side_game_participants").insert(
    parsed.data.playerIds.map((id) => ({ side_game_id: game.id, round_player_id: id, side: null })),
  );

  if (participantsError) {
    await supabase.from("side_games").delete().eq("id", game.id);
    return { status: "error", message: "Couldn't add golfers to this game. Please try again." };
  }

  revalidatePath(`/trips/${tripId}/rounds/${roundId}/games`);
  return { status: "success", message: "Nines game created." };
}

/** Creates a twos club game: same no-sides shape as skins. */
export async function createTwosGameAction(
  roundId: string,
  tripId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createTwosGameSchema.safeParse({
    name: formData.get("name"),
    scoringMetric: formData.get("scoringMetric"),
    playerIds: formData.getAll("playerIds"),
    isMonetary: formData.get("isMonetary") === "on",
    dollarValue: formData.get("dollarValue"),
    monetaryNoticeAccepted: formData.get("monetaryNoticeAccepted") === "on",
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: "error", message: "You need to be signed in." };
  }

  const { data: game, error: gameError } = await supabase
    .from("side_games")
    .insert({
      round_id: roundId,
      game_type: "twos",
      name: parsed.data.name,
      scoring_metric: parsed.data.scoringMetric,
      is_monetary: parsed.data.isMonetary,
      dollar_value: parsed.data.isMonetary ? parsed.data.dollarValue : null,
      monetary_accepted_by: parsed.data.isMonetary ? user.id : null,
      monetary_accepted_at: parsed.data.isMonetary ? new Date().toISOString() : null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (gameError || !game) {
    return { status: "error", message: "Couldn't create this game — make sure you're the trip captain." };
  }

  const { error: participantsError } = await supabase.from("side_game_participants").insert(
    parsed.data.playerIds.map((id) => ({ side_game_id: game.id, round_player_id: id, side: null })),
  );

  if (participantsError) {
    await supabase.from("side_games").delete().eq("id", game.id);
    return { status: "error", message: "Couldn't add golfers to this game. Please try again." };
  }

  revalidatePath(`/trips/${tripId}/rounds/${roundId}/games`);
  return { status: "success", message: "Twos Club game created." };
}

/**
 * Records (or corrects) the wolf's pick for one hole -- upserted on
 * (side_game_id, hole_number) so re-submitting the same hole (e.g. the
 * wolf changes their mind before the hole's played out) overwrites
 * rather than erroring on the unique constraint. Called directly from
 * the games page (useTransition), same pattern as addPressAction.
 */
export async function setWolfPickAction(
  roundId: string,
  tripId: string,
  gameId: string,
  holeNumber: number,
  partnerRoundPlayerId: string | null,
  isLoneWolf: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = wolfPickSchema.safeParse({
    holeNumber,
    partnerRoundPlayerId: partnerRoundPlayerId ?? "",
    isLoneWolf,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid pick." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You need to be signed in." };
  }

  const { error } = await supabase.from("side_game_wolf_picks").upsert(
    {
      side_game_id: gameId,
      hole_number: parsed.data.holeNumber,
      partner_round_player_id: parsed.data.partnerRoundPlayerId,
      is_lone_wolf: parsed.data.isLoneWolf,
      created_by: user.id,
    },
    { onConflict: "side_game_id,hole_number" },
  );

  if (error) {
    return { ok: false, error: "Couldn't save that pick." };
  }

  revalidatePath(`/trips/${tripId}/rounds/${roundId}/games`);
  return { ok: true };
}
