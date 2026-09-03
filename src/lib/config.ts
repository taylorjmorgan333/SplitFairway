/**
 * The one real, monitored support mailbox for SplitFairway — every
 * customer-facing surface (Contact page, data-deletion page, future
 * transactional email footers, etc.) reads from here instead of hardcoding
 * an address, so there's exactly one place to set it correctly.
 *
 * Deliberately NOT a hardcoded fallback: an invented or placeholder
 * address would look real to a user while going nowhere. If this is
 * unset, callers must show a visibly "not configured" state instead of
 * silently rendering nothing or a fake mailto link — see
 * SUPPORT_EMAIL_CONFIGURED below. Set NEXT_PUBLIC_SUPPORT_EMAIL in the
 * production environment (Vercel → Project → Settings → Environment
 * Variables) before beta users see these pages.
 */
export const SUPPORT_EMAIL: string | null =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || null;

export const SUPPORT_EMAIL_CONFIGURED = SUPPORT_EMAIL !== null;

/**
 * Server-controlled feature flags for the golf-scoring system (profiles,
 * GHIN screenshot import, live scoring, side games, monetary game
 * values). Every flag defaults OFF — same "explicit true, everything
 * else off" convention as ALLOW_DEMO_SEED — so each surface can be
 * turned on for private testing independently, in the order it's
 * actually built, without a code deploy for each flip. Read only on the
 * server (route handlers, Server Components, Server Actions); nothing
 * here is prefixed NEXT_PUBLIC_ because none of it needs to be — every
 * page that checks a flag is itself server-rendered.
 */
function flagEnabled(envVar: string | undefined): boolean {
  return envVar === "true";
}

export const GOLF_SCORING_ENABLED = flagEnabled(process.env.GOLF_SCORING_ENABLED);
export const SIDE_GAMES_ENABLED = flagEnabled(process.env.SIDE_GAMES_ENABLED);
export const MONETARY_GAME_VALUES_ENABLED = flagEnabled(
  process.env.MONETARY_GAME_VALUES_ENABLED,
);
export const GHIN_SCREENSHOT_IMPORT_ENABLED = flagEnabled(
  process.env.GHIN_SCREENSHOT_IMPORT_ENABLED,
);
export const LIVE_LEADERBOARD_ENABLED = flagEnabled(process.env.LIVE_LEADERBOARD_ENABLED);
