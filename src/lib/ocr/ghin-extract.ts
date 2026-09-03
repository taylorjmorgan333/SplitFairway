import { createWorker } from "tesseract.js";

/**
 * Server-only GHIN screenshot OCR. This reads whatever text is visible
 * in an image the golfer photographed or uploaded themselves — it does
 * not talk to GHIN.com, does not use any GHIN API, and has no
 * awareness of GHIN's systems beyond "this is roughly what a GHIN
 * profile screen tends to say." Every value it returns is a *guess*
 * the golfer must review and confirm before anything is saved — see
 * confirmGhinImportAction in src/actions/golf-ghin-import.ts, which is
 * the only place any of this is ever written to the database.
 *
 * Uses tesseract.js (open-source, MIT-licensed, runs via WASM — no paid
 * API key, no GHIN involvement). By default it fetches its trained
 * language data from tesseract.js's own CDN on first use in a given
 * serverless instance; that's a real cold-start cost worth measuring in
 * production and, if it's too slow, worth switching to a bundled/local
 * traineddata file instead (see tesseract.js docs — out of scope for
 * this pass).
 */

const LOW_CONFIDENCE_THRESHOLD = 70;

export interface ExtractedField {
  /** The best-guess value, already normalized (e.g. digits-only for a GHIN number). Null if nothing matched at all. */
  value: string | null;
  /** 0-100, from Tesseract's own per-word confidence. 0 when nothing matched. */
  confidence: number;
  /** True when the field should be visually flagged for the golfer to double-check or fill in themselves. */
  lowConfidence: boolean;
}

export interface GhinExtractionResult {
  golferName: ExtractedField;
  ghinNumber: ExtractedField;
  handicapIndex: ExtractedField;
  revisionDate: ExtractedField;
}

function field(value: string | null, confidence: number): ExtractedField {
  return {
    value,
    confidence,
    lowConfidence: value === null || confidence < LOW_CONFIDENCE_THRESHOLD,
  };
}

/** Finds the Tesseract word whose recognized text contains `needle` and returns its confidence, or null if no word matches closely enough. */
function confidenceForToken(
  words: { text: string; confidence: number }[],
  needle: string,
): number | null {
  const normalized = needle.replace(/[^a-z0-9.+-]/gi, "").toLowerCase();
  if (!normalized) return null;
  const match = words.find(
    (w) => w.text.replace(/[^a-z0-9.+-]/gi, "").toLowerCase() === normalized,
  );
  return match ? match.confidence : null;
}

function extractGhinNumber(text: string, words: { text: string; confidence: number }[]): ExtractedField {
  const labeled = text.match(/GHIN[^\d]{0,15}(\d{5,8})/i);
  const digits = labeled?.[1] ?? text.match(/\b(\d{6,8})\b/)?.[1] ?? null;
  if (!digits) return field(null, 0);
  const conf = confidenceForToken(words, digits) ?? (labeled ? 55 : 40);
  return field(digits, conf);
}

function extractHandicapIndex(text: string, words: { text: string; confidence: number }[]): ExtractedField {
  const labeled = text.match(/(?:handicap\s*index|hcp\s*index|index)[^\d+\-]{0,12}([+-]?\d{1,2}\.\d)/i);
  const value = labeled?.[1] ?? text.match(/\b([+-]?\d{1,2}\.\d)\b/)?.[1] ?? null;
  if (!value) return field(null, 0);
  const conf = confidenceForToken(words, value) ?? (labeled ? 55 : 35);
  return field(value.startsWith("+") || value.startsWith("-") ? value : value, conf);
}

function extractRevisionDate(text: string, words: { text: string; confidence: number }[]): ExtractedField {
  const labeled = text.match(
    /(?:revision date|as of|updated|effective)[^\d]{0,12}(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
  );
  const value = labeled?.[1] ?? text.match(/\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/)?.[1] ?? null;
  if (!value) return field(null, 0);
  const conf = confidenceForToken(words, value) ?? (labeled ? 55 : 30);
  return field(value, conf);
}

/**
 * Heuristic only, and the least reliable of the four — there is no
 * fixed label to anchor on. Takes the first all-letters, Title-Case-ish
 * line near the top of the screenshot as a guess at the golfer's name.
 * This value is displayed for the golfer to eyeball ("does this look
 * like your own screenshot?") — it is never written to profiles.full_name
 * or anywhere else; see the confirm UI.
 */
function extractGolferName(text: string, words: { text: string; confidence: number }[]): ExtractedField {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const nameLine = lines
    .slice(0, 8)
    .find((line) => /^[A-Za-z][A-Za-z.'-]*(\s+[A-Za-z][A-Za-z.'-]*){1,3}$/.test(line));
  if (!nameLine) return field(null, 0);
  const tokenConfidences = nameLine
    .split(/\s+/)
    .map((token) => confidenceForToken(words, token))
    .filter((c): c is number => c !== null);
  const avgConfidence =
    tokenConfidences.length > 0
      ? tokenConfidences.reduce((a, b) => a + b, 0) / tokenConfidences.length
      : 45;
  // Name detection has no label to anchor on, unlike the other three
  // fields — discount the confidence so it's flagged for review more
  // readily even when Tesseract itself was confident about the letters.
  return field(nameLine, Math.round(avgConfidence * 0.8));
}

export async function extractGhinFields(imageBuffer: Buffer): Promise<GhinExtractionResult> {
  const worker = await createWorker("eng");
  try {
    const {
      data: { text, words },
    } = await worker.recognize(imageBuffer);

    const wordList = (words ?? []).map((w) => ({ text: w.text, confidence: w.confidence }));

    return {
      golferName: extractGolferName(text, wordList),
      ghinNumber: extractGhinNumber(text, wordList),
      handicapIndex: extractHandicapIndex(text, wordList),
      revisionDate: extractRevisionDate(text, wordList),
    };
  } finally {
    await worker.terminate();
  }
}
