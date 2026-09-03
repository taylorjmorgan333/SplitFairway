"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { extractGhinFields, type ExtractedField } from "@/lib/ocr/ghin-extract";
import { golfProfileSchema } from "@/lib/validation/golf";
import type { ActionState } from "@/actions/auth";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

export type GhinExtractState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | {
      status: "extracted";
      golferName: ExtractedField;
      ghinNumber: ExtractedField;
      handicapIndex: ExtractedField;
      revisionDate: ExtractedField;
      revisionDateIso: string | null;
    };

export const initialGhinExtractState: GhinExtractState = { status: "idle" };

function toIsoDate(mmddyyyy: string | null): string | null {
  if (!mmddyyyy) return null;
  const match = mmddyyyy.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!match) return null;
  const [, mm, dd, yyyyRaw] = match;
  const yyyy = yyyyRaw.length === 2 ? (Number(yyyyRaw) > 50 ? `19${yyyyRaw}` : `20${yyyyRaw}`) : yyyyRaw;
  const iso = `${yyyy.padStart(4, "0")}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

/**
 * Step 1 of GHIN screenshot import: OCR only. Runs entirely on the
 * uploaded bytes in server memory for this one request — nothing is
 * written to storage or the database here. Every returned value is a
 * guess for the golfer to review; see confirmGhinImportAction below for
 * the only place any of this is actually saved.
 */
export async function extractGhinScreenshotAction(
  _prevState: GhinExtractState,
  formData: FormData,
): Promise<GhinExtractState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: "error", message: "You need to be signed in to import a screenshot." };
  }

  const file = formData.get("screenshot");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Choose a screenshot to import." };
  }
  if (file.size > MAX_BYTES) {
    return {
      status: "error",
      message: "That image is too large — please use a screenshot under 10 MB.",
    };
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { status: "error", message: "Please upload a JPEG, PNG, WebP, or HEIC image." };
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(await file.arrayBuffer());
  } catch {
    return { status: "error", message: "Couldn't read that image. Please try a different file." };
  }

  try {
    const result = await extractGhinFields(buffer);
    return {
      status: "extracted",
      golferName: result.golferName,
      ghinNumber: result.ghinNumber,
      handicapIndex: result.handicapIndex,
      revisionDate: result.revisionDate,
      revisionDateIso: toIsoDate(result.revisionDate.value),
    };
  } catch {
    return {
      status: "error",
      message:
        "Couldn't read that screenshot. You can still enter your information manually below.",
    };
  }
}

/**
 * Step 2: the golfer has reviewed and possibly corrected every field —
 * this is the only place any GHIN-import value is actually written.
 * Always sets handicap_source = 'ghin_screenshot_import'. The
 * screenshot itself is uploaded to private storage ONLY if the golfer
 * checked "keep my screenshot" — otherwise it is never written anywhere
 * (it existed only in this request's memory and the previous extract
 * request's memory, both already discarded).
 */
export async function confirmGhinImportAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = golfProfileSchema.safeParse({
    ghinNumber: formData.get("ghinNumber"),
    handicapIndex: formData.get("handicapIndex"),
    handicapRevisionDate: formData.get("handicapRevisionDate"),
    homeClub: formData.get("homeClub"),
    golfAssociation: formData.get("golfAssociation"),
    preferredTee: formData.get("preferredTee"),
    dominantHand: formData.get("dominantHand"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: "error", message: "You need to be signed in to save your golf profile." };
  }

  const retainScreenshot = formData.get("retainScreenshot") === "on";
  let newScreenshotPath: string | null = null;

  if (retainScreenshot) {
    const file = formData.get("screenshot");
    if (file instanceof File && file.size > 0 && file.size <= MAX_BYTES) {
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      const { error: uploadError } = await supabase.storage
        .from("ghin-screenshots")
        .upload(path, buffer, { contentType: file.type, upsert: false });
      // A failed upload does not block saving the reviewed profile
      // fields below — the golfer's confirmed values matter more than
      // the kept-screenshot bonus. ghin_screenshot_path simply stays
      // null in that case.
      if (!uploadError) {
        newScreenshotPath = path;
      }
    }
  }

  // Replacing (or clearing) a previously retained screenshot — clean up
  // the old object so storage doesn't accumulate orphaned files.
  const { data: existing } = await supabase
    .from("golf_profiles")
    .select("ghin_screenshot_path")
    .eq("user_id", user.id)
    .maybeSingle();

  const {
    ghinNumber,
    handicapIndex,
    handicapRevisionDate,
    homeClub,
    golfAssociation,
    preferredTee,
    dominantHand,
  } = parsed.data;

  const { error } = await supabase.from("golf_profiles").upsert(
    {
      user_id: user.id,
      ghin_number: ghinNumber || null,
      handicap_index: handicapIndex ? Number(handicapIndex) : null,
      handicap_revision_date: handicapRevisionDate || null,
      handicap_source: "ghin_screenshot_import",
      home_club: homeClub || null,
      golf_association: golfAssociation || null,
      preferred_tee: preferredTee || null,
      dominant_hand: dominantHand || null,
      ghin_screenshot_retained: newScreenshotPath !== null,
      ghin_screenshot_path: newScreenshotPath,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    return {
      status: "error",
      message: "Something went wrong saving your golf profile. Please try again.",
    };
  }

  if (existing?.ghin_screenshot_path && existing.ghin_screenshot_path !== newScreenshotPath) {
    await supabase.storage.from("ghin-screenshots").remove([existing.ghin_screenshot_path]);
  }

  revalidatePath("/account");
  return { status: "success", message: "Golf profile updated from your GHIN screenshot." };
}

/** Lets a golfer delete a screenshot they previously chose to retain. */
/* eslint-disable @typescript-eslint/no-unused-vars */
export async function deleteGhinScreenshotAction(
  _prevState: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  /* eslint-enable @typescript-eslint/no-unused-vars */
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: "error", message: "You need to be signed in to do that." };
  }

  const { data: existing } = await supabase
    .from("golf_profiles")
    .select("ghin_screenshot_path")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing?.ghin_screenshot_path) {
    await supabase.storage.from("ghin-screenshots").remove([existing.ghin_screenshot_path]);
  }

  const { error } = await supabase
    .from("golf_profiles")
    .update({ ghin_screenshot_retained: false, ghin_screenshot_path: null })
    .eq("user_id", user.id);

  if (error) {
    return { status: "error", message: "Couldn't remove your saved screenshot. Please try again." };
  }

  revalidatePath("/account");
  return { status: "success", message: "Screenshot removed." };
}
