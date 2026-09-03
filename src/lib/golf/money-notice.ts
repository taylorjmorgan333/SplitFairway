/**
 * The fixed notice shown before a golfer can turn on a dollar value for
 * a side game (Nassau or skins) -- gated behind MONETARY_GAME_VALUES_ENABLED
 * (src/lib/config.ts, default off). Referenced from side_games.sql's
 * monetary_accepted_by/monetary_accepted_at columns: creating a monetary
 * game requires checking this notice, and that acceptance is what those
 * columns record.
 *
 * DRAFT LEGAL COPY: this text was written to fill the requirement noted
 * back in phase 2 (see that migration's commit message) that a fixed
 * notice be shown and accepted before any monetary game can be created.
 * It has not been reviewed as actual legal language -- flag it to the
 * user for review, the same way the Privacy Policy and Terms text was
 * handled earlier in this project, before MONETARY_GAME_VALUES_ENABLED
 * is ever turned on for real users.
 */
export const MONETARY_GAME_NOTICE =
  "This game's dollar value is a private arrangement between the golfers in this round — SplitFairway only records who won and by how much. SplitFairway does not process, hold, or transfer any money, is not a party to this wager, and does not facilitate payment between golfers. By continuing, you confirm every participant is 18 or older and that private wagering of this kind is legal where you're playing.";
